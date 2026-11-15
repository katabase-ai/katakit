import { describe, expect, it, vi } from 'vitest';
import { createTranscriber, type TranscriptionSegment, type TranscriptionState } from './index';
import { workerEngine } from './workerEngine';
import type { TranscriptionWorkerRequest, TranscriptionWorkerResponse } from './workerProtocol';

class FakeWorker {
  onmessage: Worker['onmessage'] = null;
  onerror: Worker['onerror'] = null;
  onmessageerror: Worker['onmessageerror'] = null;
  requests: TranscriptionWorkerRequest[] = [];
  autoLoad = true;
  autoStart = true;
  autoDispose = true;
  terminate = vi.fn();
  postMessage = (request: TranscriptionWorkerRequest, transfer: Transferable[] = []) => {
    this.requests.push(structuredClone(request, { transfer }));
    if (
      (request.type === 'load' && this.autoLoad) ||
      (request.type === 'start' && this.autoStart) ||
      (request.type === 'dispose' && this.autoDispose)
    )
      queueMicrotask(() => this.send({ type: 'complete', id: request.id }));
  };
  send = (data: TranscriptionWorkerResponse) =>
    this.onmessage?.call(
      this as unknown as Worker,
      { data } as MessageEvent<TranscriptionWorkerResponse>
    );
  asWorker = () => this as unknown as Worker;
}
const engine = (worker: FakeWorker) =>
  workerEngine({
    model: 'moonshine-tiny',
    assetsBaseUrl: 'https://example.test/runtime/',
    createWorker: worker.asWorker,
  });

describe('library-owned recognition worker', () => {
  it('waits for session startup, preserves source buffers, and drains the tail before onStop', async () => {
    const worker = new FakeWorker();
    worker.autoStart = false;
    const results: TranscriptionSegment[] = [];
    const onStop = vi.fn();
    const states: TranscriptionState[] = [];
    const model = createTranscriber({
      engine: engine(worker),
      onFinal: result => results.push(result),
      onStop,
      onState: state => states.push(state),
    });
    const start = model.start({ sourceId: 'input' });
    await vi.waitFor(() => expect(worker.requests.at(-1)?.type).toBe('start'));
    expect(states.at(-1)?.phase).toBe('starting');
    const request = worker.requests.at(-1)!;
    if (request.type !== 'start') throw new Error('Expected a start request');
    worker.send({ type: 'complete', id: request.id });
    await start;
    const samples = new Float32Array(1632).fill(0.5);
    model.write(samples, 16_000);
    samples.fill(0);
    expect(samples.byteLength).toBe(1632 * 4);
    const stop = model.stop();
    await vi.waitFor(() => expect(worker.requests.at(-1)?.type).toBe('stop'));
    expect(worker.requests.filter(request => request.type === 'audio')).toMatchObject([
      { samples: new Float32Array(1600).fill(0.5), sampleRate: 16_000 },
      { samples: new Float32Array(32).fill(0.5), sampleRate: 16_000 },
    ]);
    expect(onStop).not.toHaveBeenCalled();
    worker.send({ type: 'final', segment: { sourceId: 'input', id: '1', text: 'Tail.' } });
    const stopped = worker.requests.at(-1)!;
    if (stopped.type !== 'stop') throw new Error('Expected a stop request');
    worker.send({ type: 'complete', id: stopped.id });
    await stop;
    expect(results).toEqual([{ sourceId: 'input', id: '1', text: 'Tail.' }]);
    expect(onStop).toHaveBeenCalledOnce();
    worker.autoStart = true;
    await model.start();
    expect(worker.requests.filter(request => request.type === 'load')).toHaveLength(1);
    worker.autoDispose = false;
    const disposal = model.dispose();
    await vi.waitFor(() => expect(worker.requests.at(-1)?.type).toBe('stop'));
    const disposed = worker.requests.at(-1)!;
    if (disposed.type !== 'stop') throw new Error('Expected a stop request');
    worker.send({ type: 'complete', id: disposed.id });
    await vi.waitFor(() => expect(worker.requests.at(-1)?.type).toBe('dispose'));
    const released = worker.requests.at(-1)!;
    if (released.type !== 'dispose') throw new Error('Expected a dispose request');
    expect(worker.terminate).not.toHaveBeenCalled();
    worker.send({ type: 'complete', id: released.id });
    await disposal;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('flushes samples using their original rate when the input format changes', async () => {
    const worker = new FakeWorker();
    const model = createTranscriber({ engine: engine(worker), onFinal: vi.fn() });
    await model.start();
    model.write(new Float32Array([1, 2, 3]), 16_000);
    model.write(new Float32Array([4, 5]), 8_000);
    const stop = model.stop();
    await vi.waitFor(() => expect(worker.requests.at(-1)?.type).toBe('stop'));
    expect(worker.requests.filter(request => request.type === 'audio')).toMatchObject([
      { samples: new Float32Array([1, 2, 3]), sampleRate: 16_000 },
      { samples: new Float32Array([4, 5]), sampleRate: 8_000 },
    ]);
    const request = worker.requests.at(-1)!;
    if (request.type !== 'stop') throw new Error('Expected a stop request');
    worker.send({ type: 'complete', id: request.id });
    await stop;
    await model.dispose();
  });

  it('rejects pending loading and releases a failed worker before a fresh owner retries', async () => {
    const first = new FakeWorker();
    first.autoLoad = false;
    const next = new FakeWorker();
    const createWorker = vi
      .fn()
      .mockReturnValueOnce(first.asWorker())
      .mockReturnValue(next.asWorker());
    const model = createTranscriber({
      engine: workerEngine({ model: 'moonshine-tiny', assetsBaseUrl: '/runtime/', createWorker }),
      onFinal: vi.fn(),
    });
    const loading = model.load();
    const rejected = (async () => {
      await expect(loading).rejects.toMatchObject({
        code: 'model-load-failed',
        message: 'download failed',
      });
    })();
    await vi.waitFor(() => expect(first.requests).toHaveLength(1));
    first.onerror?.call(first.asWorker(), { message: 'download failed' } as ErrorEvent);
    await rejected;
    expect(first.terminate).toHaveBeenCalledOnce();
    await model.load();
    await model.dispose();
    expect(next.terminate).toHaveBeenCalledOnce();
  });

  it('unblocks a failed drain and ignores results from the terminated worker', async () => {
    const worker = new FakeWorker();
    const onFinal = vi.fn();
    const model = createTranscriber({ engine: engine(worker), onFinal });
    await model.start();
    const stop = model.stop();
    const rejected = (async () => {
      await expect(stop).rejects.toMatchObject({ code: 'recognition-failed' });
    })();
    await vi.waitFor(() => expect(worker.requests.at(-1)?.type).toBe('stop'));
    worker.send({ type: 'error', code: 'recognition-failed', message: 'worker failed' });
    await rejected;
    await model.dispose();
    worker.send({ type: 'final', segment: { sourceId: 'late', id: '1', text: 'late' } });
    expect(onFinal).not.toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
