import { describe, expect, it, vi } from 'vitest';
import { installWhisperWorker } from './whisperWorker';
import type { WhisperResponse } from './whisperProtocol';

const mocks = vi.hoisted(() => {
  const recognize = vi.fn(async () => ({ text: 'recognized' }));
  return {
    recognize,
    pipeline: vi.fn(async () => recognize),
    env: { allowLocalModels: true },
  };
});
vi.mock('@xenova/transformers', () => mocks);

describe('Whisper worker runtime', () => {
  it('loads the English tiny model once and sends progress and correlated results', async () => {
    const scope: Parameters<typeof installWhisperWorker>[0] = {
      postMessage: vi.fn(),
      onmessage: null,
    };
    installWhisperWorker(scope);
    await scope.onmessage!({ data: { type: 'warmup' } } as MessageEvent);
    expect(mocks.env.allowLocalModels).toBe(false);
    expect(mocks.pipeline).toHaveBeenCalledWith(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en',
      expect.objectContaining({ quantized: true })
    );
    const options = mocks.pipeline.mock.calls[0] as unknown as [
      string,
      string,
      {
        progress_callback: (event: unknown) => void;
      },
    ];
    options[2].progress_callback({ progress: 25 });
    const audio = new Float32Array(16);
    await scope.onmessage!({ data: { type: 'transcribe', id: 3, audio } } as MessageEvent);
    expect(mocks.pipeline).toHaveBeenCalledOnce();
    expect(mocks.recognize).toHaveBeenCalledWith(audio, { top_k: 0, do_sample: false });
    expect(scope.postMessage).toHaveBeenCalledWith({ type: 'ready' } satisfies WhisperResponse);
    expect(scope.postMessage).toHaveBeenCalledWith({
      type: 'progress',
      progress: 0.25,
    } satisfies WhisperResponse);
    expect(scope.postMessage).toHaveBeenCalledWith({
      type: 'transcript',
      id: 3,
      text: 'recognized',
    } satisfies WhisperResponse);
    mocks.recognize.mockRejectedValueOnce(new Error('recognition failed'));
    await scope.onmessage!({ data: { type: 'transcribe', id: 4, audio } } as MessageEvent);
    expect(scope.postMessage).toHaveBeenCalledWith({
      type: 'error',
      message: 'recognition failed',
    } satisfies WhisperResponse);
  });
});
