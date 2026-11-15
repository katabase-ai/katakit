import type { Provider, ProviderEvents } from './types';
import { createWhisperChunks } from './whisperChunks';
import type { WhisperRequest, WhisperResponse } from './whisperProtocol';

export type WhisperOptions = {
  provider: 'whisper';
  /** A dedicated worker running installWhisperWorker from the whisper-worker entry. */
  createWorker: () => Worker;
};

export const loadWhisper = async (
  options: WhisperOptions,
  events: ProviderEvents
): Promise<Provider> => {
  const worker = options.createWorker();
  const ready = Promise.withResolvers<void>();
  let drain: ReturnType<typeof Promise.withResolvers<void>> | undefined;
  let failure: Error | undefined;
  let chunks = createWhisperChunks();
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
      chunks = createWhisperChunks();
      nextId = 0;
    },
    write: (audio, sampleRate) => {
      if (failure) throw failure;
      if (sampleRate !== 16_000) throw new Error('Whisper requires 16 kHz audio.');
      // Copy before buffering: sources may reuse their PCM arrays after write returns.
      for (const chunk of chunks.push(audio.slice())) enqueue(chunk);
    },
    stop: async () => {
      if (failure) throw failure;
      const last = chunks.flush();
      if (last) enqueue(last);
      if (inFlight || queued.length) {
        drain = Promise.withResolvers<void>();
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
      chunks = createWhisperChunks();
      worker.terminate();
    },
  };
};
