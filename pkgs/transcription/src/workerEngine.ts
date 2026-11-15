import { deferred } from './deferred';
import { createPcmChunks } from './pcmChunks';
import { TranscriptionError, transcriptionError } from './errors';
import type { TranscriptionModelId } from './catalog';
import type { TranscriptionEngine } from './types';
import type { TranscriptionWorkerRequest, TranscriptionWorkerResponse } from './workerProtocol';

type Command = TranscriptionWorkerRequest extends infer Request
  ? Request extends { id: number }
    ? Omit<Request, 'id'>
    : never
  : never;

/** Own a recognition worker, including PCM batching, acknowledgments, and failure cleanup. */
export const workerEngine =
  (options: {
    model: TranscriptionModelId;
    assetsBaseUrl: string;
    createWorker: () => Worker;
  }): TranscriptionEngine =>
  async events => {
    const worker = options.createWorker();
    let sequence = 0;
    let loaded = false;
    let failure: TranscriptionError | undefined;
    const pending = new Map<number, ReturnType<typeof deferred<void>>>();
    let chunks = createPcmChunks();
    let sampleRate: number | undefined;

    const fail = (error: unknown) => {
      if (failure) return;
      failure = transcriptionError(error, loaded ? 'recognition-failed' : 'model-load-failed');
      for (const operation of pending.values()) operation.reject(failure);
      pending.clear();
      events.onError(failure);
    };
    const terminate = () => {
      worker.onmessage = worker.onerror = worker.onmessageerror = null;
      chunks = createPcmChunks();
      worker.terminate();
    };
    worker.onerror = event =>
      fail(
        event.message ||
          'Transcription worker failed. Check its runtime asset URL and the host CSP.'
      );
    worker.onmessageerror = () => fail('Transcription worker message could not be decoded.');
    worker.onmessage = ({ data }: MessageEvent<TranscriptionWorkerResponse>) => {
      if (failure) return;
      try {
        if (data.type === 'complete') {
          pending.get(data.id)?.resolve();
          pending.delete(data.id);
        } else if (data.type === 'progress') events.onProgress(data.progress);
        else if (data.type === 'provisional') events.onProvisional(data.text);
        else if (data.type === 'final') events.onFinal(data.segment);
        else if (data.type === 'error') fail(new TranscriptionError(data.code, data.message));
      } catch (error) {
        fail(error);
      }
    };
    const command = (request: Command) => {
      if (failure) return Promise.reject(failure);
      const operation = deferred<void>();
      const id = sequence++;
      pending.set(id, operation);
      try {
        worker.postMessage({ ...request, id } satisfies TranscriptionWorkerRequest);
      } catch (error) {
        fail(error);
      }
      return operation.promise;
    };
    const send = (samples: Float32Array) => {
      try {
        worker.postMessage(
          { type: 'audio', samples, sampleRate: sampleRate! } satisfies TranscriptionWorkerRequest,
          [samples.buffer]
        );
      } catch (error) {
        fail(error);
        throw failure;
      }
    };
    const flush = () => {
      const tail = chunks.flush();
      if (tail) send(tail);
    };
    try {
      await command({ type: 'load', model: options.model, assetsBaseUrl: options.assetsBaseUrl });
      loaded = true;
    } catch (error) {
      terminate();
      throw error;
    }
    return {
      start: async sourceId => {
        chunks = createPcmChunks();
        sampleRate = undefined;
        await command({ type: 'start', sourceId });
      },
      write: (audio, rate) => {
        if (failure) throw failure;
        if (rate !== sampleRate) {
          flush();
          sampleRate = rate;
          chunks = createPcmChunks(Math.max(1, Math.floor(rate / 10)));
        }
        // Buffer ownership stays with the caller; transfers only detach utility-owned copies.
        for (const chunk of chunks.push(audio.slice())) send(chunk);
      },
      stop: async () => {
        if (failure) throw failure;
        flush();
        await command({ type: 'stop' });
      },
      close: async () => {
        try {
          if (!failure) await command({ type: 'dispose' });
        } finally {
          terminate();
        }
      },
    };
  };
