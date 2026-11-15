import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installTranscriptionWorker } from './workerRuntime';
import { TranscriptionError } from './errors';
import type { EngineEvents, EngineSession } from './types';
import type { TranscriptionWorkerRequest, TranscriptionWorkerResponse } from './workerProtocol';

const mocks = vi.hoisted(() => ({ engine: vi.fn() }));
vi.mock('./providerEngine', () => ({ createProviderEngine: mocks.engine }));
beforeEach(() => vi.clearAllMocks());

describe('generic transcription worker runtime', () => {
  it('serializes startup, PCM, and stop while delivering final results before the stop acknowledgment', async () => {
    let sink!: EngineEvents;
    let sourceId = '';
    const calls: string[] = [];
    const loaded = Promise.withResolvers<EngineSession>();
    mocks.engine.mockReturnValue((events: EngineEvents) => {
      sink = events;
      return loaded.promise;
    });
    const messages: TranscriptionWorkerResponse[] = [];
    const scope: Parameters<typeof installTranscriptionWorker>[0] = {
      postMessage: message => messages.push(message),
      onmessage: null,
    };
    installTranscriptionWorker(scope);
    const send = (data: TranscriptionWorkerRequest) =>
      scope.onmessage!({ data } as MessageEvent<TranscriptionWorkerRequest>);
    send({ type: 'load', id: 0, model: 'moonshine-tiny', assetsBaseUrl: '/runtime/' });
    send({ type: 'start', id: 1, sourceId: 'session' });
    send({ type: 'audio', samples: new Float32Array(16), sampleRate: 16_000 });
    send({ type: 'stop', id: 2 });
    await vi.waitFor(() => expect(mocks.engine).toHaveBeenCalledOnce());
    expect(calls).toEqual([]);
    loaded.resolve({
      start: async id => {
        sourceId = id;
        calls.push('start');
      },
      write: () => {
        calls.push('write');
        sink.onProvisional('preview');
      },
      stop: () => {
        calls.push('stop');
        sink.onFinal({ sourceId, id: '1', text: 'Final.' });
      },
      close: vi.fn(),
    });
    await vi.waitFor(() => expect(messages.at(-1)).toEqual({ type: 'complete', id: 2 }));
    expect(calls).toEqual(['start', 'write', 'stop']);
    expect(messages).toContainEqual({ type: 'provisional', text: 'preview' });
    expect(messages.at(-2)).toEqual({
      type: 'final',
      segment: { sourceId: 'session', id: '1', text: 'Final.' },
    });
    send({ type: 'dispose', id: 3 });
    await vi.waitFor(() => expect(messages.at(-1)).toEqual({ type: 'complete', id: 3 }));
    expect((await loaded.promise).close).toHaveBeenCalledOnce();
  });

  it('preserves error codes across the worker boundary and sends no successful load acknowledgment', async () => {
    mocks.engine.mockReturnValue(async () => {
      throw new TranscriptionError('cross-origin-isolation-required', 'Configure isolation');
    });
    const messages: TranscriptionWorkerResponse[] = [];
    const scope: Parameters<typeof installTranscriptionWorker>[0] = {
      postMessage: message => messages.push(message),
      onmessage: null,
    };
    installTranscriptionWorker(scope);
    scope.onmessage!({
      data: { type: 'load', id: 0, model: 'moonshine-tiny', assetsBaseUrl: '/runtime/' },
    } as MessageEvent<TranscriptionWorkerRequest>);
    await vi.waitFor(() =>
      expect(messages).toContainEqual({
        type: 'error',
        code: 'cross-origin-isolation-required',
        message: 'Configure isolation',
      })
    );
    expect(messages.filter(message => message.type === 'complete')).toEqual([]);
    expect(messages.filter(message => message.type === 'error')).toHaveLength(1);
  });
});
