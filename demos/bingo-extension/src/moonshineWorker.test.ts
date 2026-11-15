import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranscriptionCallbacks, Transcriber } from '@katakit/transcription';
import type { MoonshineRequest, MoonshineResponse } from './moonshineProtocol';

const createTranscriber = vi.hoisted(() => vi.fn());
vi.mock('@katakit/transcription', () => ({ createTranscriber }));
vi.mock('@katakit/transcription/moonshine', () => ({ moonshine: vi.fn() }));

const worker = {
  postMessage: vi.fn<(message: MoonshineResponse) => void>(),
  onmessage: undefined as ((event: { data: MoonshineRequest }) => Promise<void>) | undefined,
};
let callbacks: TranscriptionCallbacks;
let transcriber: Transcriber;

beforeAll(async () => {
  vi.stubGlobal('self', worker);
  await import('./moonshineWorker');
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  worker.postMessage.mockClear();
  transcriber = {
    load: vi.fn(async () => {}),
    start: vi.fn(async () => {}),
    write: vi.fn(),
    stop: vi.fn(async () => {}),
    dispose: vi.fn(async () => {}),
  };
  createTranscriber.mockImplementation((options: TranscriptionCallbacks) => {
    callbacks = options;
    return transcriber;
  });
});

const send = (data: MoonshineRequest) => worker.onmessage!({ data });

describe('extension Moonshine worker errors', () => {
  it('sends a failed load only once when both state and the promise report it', async () => {
    const failure = Object.assign(new Error('model unavailable'), {
      code: 'model-load-failed' as const,
    });
    transcriber.load = vi.fn(async () => {
      callbacks.onState?.({ phase: 'error', error: failure });
      throw failure;
    });

    await send({ type: 'warmup', assetUrl: '/moonshine/index.js' });

    expect(worker.postMessage.mock.calls.map(([message]) => message)).toEqual([
      { type: 'error', message: 'model unavailable' },
    ]);
  });

  it('still reports errors that do not come from transcriber state', async () => {
    await send({ type: 'warmup', assetUrl: '/moonshine/index.js' });
    worker.postMessage.mockClear();
    const failure = new Error('unexpected start failure');
    transcriber.start = vi.fn(async () => {
      throw failure;
    });

    await send({ type: 'start', sourceId: 'recording' });

    expect(worker.postMessage.mock.calls.map(([message]) => message)).toEqual([
      { type: 'error', message: 'unexpected start failure' },
    ]);
  });

  it('reports asynchronous recognition errors through state', async () => {
    await send({ type: 'warmup', assetUrl: '/moonshine/index.js' });
    worker.postMessage.mockClear();

    callbacks.onState?.({
      phase: 'error',
      error: Object.assign(new Error('recognition failed'), {
        code: 'recognition-failed' as const,
      }),
    });

    expect(worker.postMessage.mock.calls.map(([message]) => message)).toEqual([
      { type: 'error', message: 'recognition failed' },
    ]);
  });
});
