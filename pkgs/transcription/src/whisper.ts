import { deferred } from './deferred';
import type { EngineSession, EngineEvents, TranscriptionEngine } from './types';
import { createPcmChunks } from './pcmChunks';
import type { WhisperRequest, WhisperResponse } from './whisperProtocol';
import { TranscriptionError } from './errors';

export type WhisperOptions = {
  /** A dedicated worker running installWhisperWorker from the whisper-worker entry. */
  createWorker: () => Worker;
};

const loadWhisper = async (
  options: WhisperOptions,
  events: EngineEvents
): Promise<EngineSession> => {
  const worker = options.createWorker();
  const ready = deferred<void>();
  let drain: ReturnType<typeof deferred<void>> | undefined;
  let failure: Error | undefined;
  let chunks = createPcmChunks(160_000);
  let sourceId = '';
  let nextId = 0;
  let queued: { id: number; audio: Float32Array }[] = [];
  let inFlight: { id: number; durationMs: number } | undefined;

  const fail = (error: unknown) => {
    if (failure) return;
    failure = error instanceof Error ? error : new Error(String(error));
    ready.reject(failure);
    drain?.reject(failure);
    events.onError(failure);
  };
  const sendNext = () => {
    if (inFlight || !queued.length || failure) return;
    const next = queued.shift()!;
    inFlight = { id: next.id, durationMs: next.audio.length / 16 };
    worker.postMessage({ type: 'transcribe', ...next } satisfies WhisperRequest, [
      next.audio.buffer,
    ]);
  };
  const enqueue = (audio: Float32Array) => {
    queued.push({ id: nextId++, audio });
    sendNext();
  };
  worker.onerror = event => fail(event.message || 'Whisper worker failed');
  worker.onmessageerror = () => fail('Whisper worker message could not be decoded');
  worker.onmessage = ({ data }: MessageEvent<WhisperResponse>) => {
    if (failure) return;
    try {
      if (data.type === 'error') fail(data.message);
      else if (data.type === 'progress') events.onProgress(data.progress);
      else if (data.type === 'ready') ready.resolve();
      else if (data.type === 'transcript' && inFlight?.id === data.id) {
        const durationMs = inFlight.durationMs;
        inFlight = undefined;
        if (data.text.trim()) {
          events.onFinal({
            sourceId,
            id: String(data.id),
            text: data.text,
            startMs: data.id * 10_000,
            endMs: data.id * 10_000 + durationMs,
          });
        }
        sendNext();
        if (!inFlight && !queued.length) drain?.resolve();
      }
    } catch (error) {
      fail(error);
    }
  };
  try {
    worker.postMessage({ type: 'warmup' } satisfies WhisperRequest);
    await ready.promise;
  } catch (error) {
    worker.terminate();
    throw error;
  }

  return {
    start: id => {
      sourceId = id;
      chunks = createPcmChunks(160_000);
      nextId = 0;
    },
    write: (audio, sampleRate) => {
      if (failure) throw failure;
      if (sampleRate !== 16_000)
        throw new TranscriptionError(
          'audio-format-unsupported',
          'Whisper requires 16 kHz mono PCM.'
        );
      // Copy before buffering: sources may reuse their PCM arrays after write returns.
      for (const chunk of chunks.push(audio.slice())) enqueue(chunk);
    },
    stop: async () => {
      if (failure) throw failure;
      const last = chunks.flush();
      if (last) enqueue(last);
      if (inFlight || queued.length) {
        drain = deferred<void>();
        try {
          await drain.promise;
        } finally {
          drain = undefined;
        }
      }
    },
    close: () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      queued = [];
      chunks = createPcmChunks(160_000);
      worker.terminate();
    },
  };
};

export const whisper =
  (options: WhisperOptions): TranscriptionEngine =>
  events =>
    loadWhisper(options, events);
