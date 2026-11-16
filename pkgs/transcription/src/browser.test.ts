import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBrowserTranscriber,
  createMicrophoneTranscriber,
  defaultTranscriptionModel,
} from './browser';
import { checkBrowserSupport, transcriptionAssetUrl } from './browserRuntime';

afterEach(() => vi.unstubAllGlobals());

describe('browser setup', () => {
  it('uses the catalog default for both PCM and microphone transcription', async () => {
    expect(defaultTranscriptionModel).toBe('moonshine-small');
    vi.stubGlobal('Worker', vi.fn());
    vi.stubGlobal('crossOriginIsolated', false);
    for (const create of [createBrowserTranscriber, createMicrophoneTranscriber]) {
      const input = create({ onFinal: vi.fn() });
      await expect(input.load()).rejects.toMatchObject({ code: 'cross-origin-isolation-required' });
      await input.dispose();
    }
  });

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

  it('classifies worker construction failures at the shared model boundary', async () => {
    vi.stubGlobal('location', new URL('https://example.test/app/'));
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('worker blocked');
        }
      }
    );
    const onState = vi.fn();
    const model = createBrowserTranscriber({ model: 'whisper-tiny', onFinal: vi.fn(), onState });
    await expect(model.load()).rejects.toMatchObject({
      code: 'model-load-failed',
      message: 'worker blocked',
    });
    expect(onState).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'error',
        error: expect.objectContaining({ code: 'model-load-failed' }),
      })
    );
    await model.dispose();
  });

  it.each([
    ['whisper-tiny', 'whisper-worker.js'],
    ['moonshine-tiny', 'transcription-worker.js'],
  ] as const)(
    'creates the packaged %s worker from an application-relative asset base',
    async (modelId, filename) => {
      vi.stubGlobal('location', new URL('https://example.test/app/'));
      vi.stubGlobal('crossOriginIsolated', true);
      const workers: {
        onmessage: ((event: { data: object }) => void) | null;
        terminate: ReturnType<typeof vi.fn>;
      }[] = [];
      const Worker = vi.fn(
        function (this: {
          onmessage: ((event: { data: object }) => void) | null;
          postMessage: (request: { id?: number }) => void;
          terminate: ReturnType<typeof vi.fn>;
        }) {
          this.onmessage = null;
          this.postMessage = request =>
            queueMicrotask(() =>
              this.onmessage?.({
                data:
                  request.id === undefined
                    ? { type: 'ready' }
                    : { type: 'complete', id: request.id },
              })
            );
          this.terminate = vi.fn();
          workers.push(this);
        }
      );
      vi.stubGlobal('Worker', Worker);
      const model = createBrowserTranscriber({
        model: modelId,
        assetsBaseUrl: './runtime',
        onFinal: vi.fn(),
      });
      await model.load();
      expect(Worker).toHaveBeenCalledWith(`https://example.test/app/runtime/${filename}`, {
        type: 'module',
      });
      expect(transcriptionAssetUrl('./runtime/', 'microphone-worklet.js')).toBe(
        'https://example.test/app/runtime/microphone-worklet.js'
      );
      await model.dispose();
      expect(workers[0]?.terminate).toHaveBeenCalledOnce();
    }
  );
});
