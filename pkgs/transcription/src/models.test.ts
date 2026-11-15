import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { TranscriptEventListener, TranscriptLine } from '@moonshine-ai/moonshine-wasm';
import { createTranscriber, type TranscriptionState } from './index';
import { moonshine as moonshineEngine, type MoonshineOptions } from './moonshine';
import { whisper } from './whisper';
import type { WhisperRequest, WhisperResponse } from './whisperProtocol';
import { createWhisperChunks } from './whisperChunks';

const moonshine = () => {
  const listeners: TranscriptEventListener[] = [];
  const stream = {
    start: vi.fn(),
    stop: vi.fn(),
    close: vi.fn(),
    addAudio: vi.fn(),
    transcribe: vi.fn(),
    addListener: (listener: TranscriptEventListener) => listeners.push(listener),
  };
  const model = { createStream: vi.fn(() => stream), close: vi.fn() };
  const load = vi.fn(async () => model);
  const sdk = { Transcriber: { load } } as unknown as Awaited<
    ReturnType<MoonshineOptions['loadSdk']>
  >;
  const options: MoonshineOptions = { loadSdk: async () => sdk };
  const line = (text: string) =>
    ({ id: '1', text, startTime: 0.5, duration: 0.75 }) as TranscriptLine;
  return { options, sdk, load, stream, model, listeners, line };
};

class FakeWorker {
  onmessage: Worker['onmessage'] = null;
  onerror: Worker['onerror'] = null;
  onmessageerror: Worker['onmessageerror'] = null;
  requests: WhisperRequest[] = [];
  terminate = vi.fn();
  autoReady = true;
  postMessage = (request: WhisperRequest) => {
    this.requests.push(request);
    if (request.type === 'warmup' && this.autoReady)
      queueMicrotask(() => this.send({ type: 'ready' }));
  };
  send = (data: WhisperResponse) => {
    this.onmessage?.call(this as unknown as Worker, { data } as MessageEvent<WhisperResponse>);
  };
  asWorker = () => this as unknown as Worker;
}

describe('shared transcription model', () => {
  it('loads once, normalizes Moonshine results, and drains before notifying stop', async () => {
    expectTypeOf<typeof import('@moonshine-ai/moonshine-wasm')>().toMatchTypeOf<
      Awaited<ReturnType<MoonshineOptions['loadSdk']>>
    >();
    const mock = moonshine();
    const finals: import('./types').TranscriptionSegment[] = [];
    let provisional = '';
    const onStop = vi.fn();
    const phases: TranscriptionState['phase'][] = [];
    const model = createTranscriber({
      engine: moonshineEngine({ ...mock.options, model: 'medium' }),
      onState: ({ phase }) => phases.push(phase),
      onProvisional: text => {
        provisional = text;
      },
      onFinal: segment => finals.push(segment),
      onStop,
    });
    await Promise.all([
      model.load(),
      model.start({ sourceId: 'pcm-source' }),
      model.start({ sourceId: 'ignored' }),
    ]);
    expect(mock.load).toHaveBeenCalledTimes(1);
    expect(mock.load).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en', modelArch: 5 })
    );
    expect(mock.model.createStream).toHaveBeenCalledTimes(1);
    const audio = new Float32Array([0.1, 0.2]);
    model.write(audio, 48_000);
    expect(mock.stream.addAudio).toHaveBeenCalledWith(audio, 48_000);
    expect(mock.stream.transcribe).toHaveBeenCalledOnce();
    const listener = mock.listeners[0]!;
    listener.onLineStarted?.({ line: mock.line('preview') });
    expect(provisional).toBe('preview');
    mock.stream.stop.mockImplementation(() => {
      listener.onLineCompleted?.({ line: mock.line('Final.') });
      listener.onLineCompleted?.({ line: mock.line('Final.') });
    });
    await Promise.all([model.stop(), model.stop()]);
    expect(finals).toHaveLength(1);
    expect(onStop).toHaveBeenCalledOnce();
    expect(finals[0]).toMatchObject({
      sourceId: 'pcm-source',
      text: 'Final.',
      startMs: 500,
      endMs: 1250,
    });
    expect(mock.stream.stop).toHaveBeenCalledOnce();
    expect(mock.stream.close).toHaveBeenCalledOnce();
    await model.start({ sourceId: 'second-source' });
    await model.stop();
    expect(mock.load).toHaveBeenCalledOnce();
    await Promise.all([model.dispose(), model.dispose()]);
    await expect(model.start()).rejects.toMatchObject({ code: 'disposed' });
    expect(mock.model.close).toHaveBeenCalledOnce();
    expect(mock.model.createStream).toHaveBeenCalledTimes(2);
    expect(phases).toContain('running');
  });

  it('waits for a pending load on disposal and suppresses late results', async () => {
    const mock = moonshine();
    const loading = Promise.withResolvers<Awaited<ReturnType<MoonshineOptions['loadSdk']>>>();
    const loadSdk = vi.fn(() => loading.promise);
    const onFinal = vi.fn();
    const onState = vi.fn();
    const model = createTranscriber({
      engine: moonshineEngine({ ...mock.options, loadSdk }),
      onFinal,
      onState,
    });
    const start = model.start();
    await vi.waitFor(() => expect(loadSdk).toHaveBeenCalledOnce());
    const dispose = model.dispose();
    const stateCalls = onState.mock.calls.length;
    loading.resolve(mock.sdk);
    await Promise.all([start, dispose]);
    expect(mock.model.createStream).not.toHaveBeenCalled();
    expect(mock.model.close).toHaveBeenCalledOnce();
    expect(onState).toHaveBeenCalledTimes(stateCalls);
    expect(onFinal).not.toHaveBeenCalled();
  });

  it('closes a failed Moonshine stream and allows model loading to be retried', async () => {
    const mock = moonshine();
    const states: TranscriptionState[] = [];
    const model = createTranscriber({
      engine: moonshineEngine(mock.options),
      onFinal: vi.fn(),
      onState: state => states.push(state),
    });
    await model.start();
    mock.stream.transcribe.mockImplementationOnce(() => {
      throw new Error('recognition failed');
    });
    expect(() => model.write(new Float32Array(8), 16_000)).toThrow('recognition failed');
    await vi.waitFor(() => expect(mock.model.close).toHaveBeenCalledOnce());
    expect(mock.stream.close).toHaveBeenCalledOnce();
    expect(states.at(-1)).toMatchObject({
      phase: 'error',
      error: { code: 'recognition-failed', message: 'recognition failed' },
    });
    await model.start();
    expect(mock.load).toHaveBeenCalledTimes(2);
    await model.dispose();
  });

  it('rejects a failed load and supports retry', async () => {
    const mock = moonshine();
    const loadSdk = vi
      .fn()
      .mockRejectedValueOnce(new Error('download failed'))
      .mockResolvedValue(mock.sdk);
    const model = createTranscriber({
      engine: moonshineEngine({ ...mock.options, loadSdk }),
      onFinal: vi.fn(),
    });
    await expect(model.load()).rejects.toThrow('download failed');
    await model.start();
    expect(loadSdk).toHaveBeenCalledTimes(2);
    await model.dispose();
  });

  it('queues Whisper chunks in order, keeps source buffers intact, and drains the partial tail', async () => {
    const worker = new FakeWorker();
    const onFinal = vi.fn();
    const onStop = vi.fn();
    const model = createTranscriber({
      engine: whisper({ createWorker: worker.asWorker }),
      onFinal,
      onStop,
    });
    await model.start({ sourceId: 'buffer-source' });
    const audio = new Float32Array(320_032).fill(0.5);
    model.write(audio, 16_000);
    audio.fill(0);
    expect(worker.requests.map(request => request.type)).toEqual(['warmup', 'transcribe']);
    expect(worker.requests[1]).toMatchObject({ id: 0, audio: new Float32Array(160_000).fill(0.5) });
    const stop = model.stop();
    await vi.waitFor(() => expect(onStop).not.toHaveBeenCalled());
    worker.send({ type: 'transcript', id: 0, text: 'First.' });
    expect(worker.requests[2]).toMatchObject({ id: 1 });
    worker.send({ type: 'transcript', id: 1, text: 'Second.' });
    expect(worker.requests[3]).toMatchObject({ id: 2, audio: new Float32Array(32).fill(0.5) });
    expect(onStop).not.toHaveBeenCalled();
    worker.send({ type: 'transcript', id: 2, text: 'Tail.' });
    await stop;
    expect(onFinal.mock.calls.map(([segment]) => segment)).toEqual([
      { sourceId: 'buffer-source', id: '0', text: 'First.', startMs: 0, endMs: 10_000 },
      { sourceId: 'buffer-source', id: '1', text: 'Second.', startMs: 10_000, endMs: 20_000 },
      { sourceId: 'buffer-source', id: '2', text: 'Tail.', startMs: 20_000, endMs: 20_002 },
    ]);
    expect(onStop).toHaveBeenCalledOnce();
    await model.start({ sourceId: 'another-source' });
    model.write(new Float32Array(16), 16_000);
    const secondStop = model.stop();
    await vi.waitFor(() => expect(worker.requests).toHaveLength(5));
    worker.send({ type: 'transcript', id: 0, text: 'Again.' });
    await secondStop;
    expect(onFinal.mock.calls.at(-1)?.[0]).toMatchObject({ sourceId: 'another-source', id: '0' });
    expect(worker.requests.filter(request => request.type === 'warmup')).toHaveLength(1);
    await Promise.all([model.dispose(), model.dispose()]);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('unblocks failed Whisper loading and terminates the failed worker before retry', async () => {
    const first = new FakeWorker();
    first.autoReady = false;
    const next = new FakeWorker();
    const createWorker = vi
      .fn()
      .mockReturnValueOnce(first.asWorker())
      .mockReturnValue(next.asWorker());
    const model = createTranscriber({ engine: whisper({ createWorker }), onFinal: vi.fn() });
    const start = model.start();
    const rejection = (async () => {
      await expect(start).rejects.toThrow('worker crashed');
    })();
    await vi.waitFor(() => expect(first.requests).toHaveLength(1));
    first.send({ type: 'error', message: 'worker crashed' });
    await rejection;
    await model.start();
    expect(first.terminate).toHaveBeenCalledOnce();
    expect(createWorker).toHaveBeenCalledTimes(2);
    await model.dispose();
    expect(next.terminate).toHaveBeenCalledOnce();
  });

  it('disposes a Whisper worker once a pending warmup settles without starting a session', async () => {
    const worker = new FakeWorker();
    worker.autoReady = false;
    const onFinal = vi.fn();
    const model = createTranscriber({
      engine: whisper({ createWorker: worker.asWorker }),
      onFinal,
    });
    const start = model.start();
    await vi.waitFor(() => expect(worker.requests).toHaveLength(1));
    const dispose = model.dispose();
    worker.send({ type: 'ready' });
    await Promise.all([start, dispose, model.dispose()]);
    expect(() => model.write(new Float32Array(160_000), 16_000)).toThrow('disposed');
    expect(worker.requests).toHaveLength(1);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(onFinal).not.toHaveBeenCalled();
  });

  it('unblocks a failed Whisper drain and ignores subsequent results', async () => {
    const worker = new FakeWorker();
    const onFinal = vi.fn();
    const model = createTranscriber({
      engine: whisper({ createWorker: worker.asWorker }),
      onFinal,
    });
    await model.start();
    model.write(new Float32Array(16), 16_000);
    const stop = model.stop();
    const rejection = (async () => {
      await expect(stop).rejects.toThrow('inference failed');
    })();
    await vi.waitFor(() => expect(worker.requests).toHaveLength(2));
    worker.send({ type: 'error', message: 'inference failed' });
    await rejection;
    await model.dispose();
    expect(worker.terminate).toHaveBeenCalledOnce();
    worker.send({ type: 'transcript', id: 0, text: 'late' });
    expect(onFinal).not.toHaveBeenCalled();
  });

  it('rejects unsupported Whisper sample rates and releases resources', async () => {
    const worker = new FakeWorker();
    const model = createTranscriber({
      engine: whisper({ createWorker: worker.asWorker }),
      onFinal: vi.fn(),
    });
    await model.start();
    expect(() => model.write(new Float32Array(8), 48_000)).toThrow('16 kHz');
    await vi.waitFor(() => expect(worker.terminate).toHaveBeenCalledOnce());
    await model.dispose();
  });

  it('keeps contiguous PCM across buffer boundaries and flushes once', () => {
    const chunks = createWhisperChunks(4);
    expect(chunks.push(new Float32Array([1, 2, 3]))).toEqual([]);
    expect(chunks.push(new Float32Array([4, 5, 6, 7, 8, 9]))).toEqual([
      new Float32Array([1, 2, 3, 4]),
      new Float32Array([5, 6, 7, 8]),
    ]);
    expect(chunks.flush()).toEqual(new Float32Array([9]));
    expect(chunks.flush()).toBeUndefined();
  });
});
