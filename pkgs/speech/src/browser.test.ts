import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserTranscriber, createMicrophoneTranscriber } from './browser';
import { checkBrowserSupport, speechAssetUrl } from './browserRuntime';

afterEach(() => vi.unstubAllGlobals());

describe('browser setup', () => {
  it('can be imported and constructed without touching browser APIs', async () => {
    const Worker = vi.fn();
    vi.stubGlobal('Worker', Worker);
    const raw = createBrowserTranscriber({ model: 'whisper-tiny', onFinal: vi.fn() });
    const microphone = createMicrophoneTranscriber({ model: 'whisper-tiny', onFinal: vi.fn() });
    expect(Worker).not.toHaveBeenCalled();
    await raw.dispose();
    await microphone.dispose();
  });

  it('reports the Moonshine isolation requirement before SDK or model loading', async () => {
    vi.stubGlobal('Worker', vi.fn());
    vi.stubGlobal('crossOriginIsolated', false);
    const model = createBrowserTranscriber({ model: 'moonshine-tiny', onFinal: vi.fn() });
    await expect(model.load()).rejects.toMatchObject({ code: 'cross-origin-isolation-required' });
    expect(Worker).not.toHaveBeenCalled();
    await model.dispose();
    expect(() => checkBrowserSupport('whisper-tiny')).not.toThrow();
  });

  it('creates the packaged module worker from an application-relative asset base', async () => {
    vi.stubGlobal('location', new URL('https://example.test/app/'));
    const workers: {
      onmessage: ((event: { data: object }) => void) | null;
      terminate: ReturnType<typeof vi.fn>;
    }[] = [];
    const Worker = vi.fn(
      function (this: {
        onmessage: ((event: { data: object }) => void) | null;
        postMessage: () => void;
        terminate: ReturnType<typeof vi.fn>;
      }) {
        this.onmessage = null;
        this.postMessage = () =>
          queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } }));
        this.terminate = vi.fn();
        workers.push(this);
      }
    );
    vi.stubGlobal('Worker', Worker);
    const model = createBrowserTranscriber({
      model: 'whisper-tiny',
      assetsBaseUrl: './runtime',
      onFinal: vi.fn(),
    });
    await model.load();
    expect(Worker).toHaveBeenCalledWith('https://example.test/app/runtime/whisper-worker.js', {
      type: 'module',
    });
    expect(speechAssetUrl('./runtime/', 'microphone-worklet.js')).toBe(
      'https://example.test/app/runtime/microphone-worklet.js'
    );
    await model.dispose();
    expect(workers[0]?.terminate).toHaveBeenCalledOnce();
  });
});
