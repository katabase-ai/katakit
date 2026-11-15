import { env, pipeline } from '@xenova/transformers';
import type { WhisperRequest, WhisperResponse } from './whisperProtocol';

type WorkerScope = {
  postMessage: (message: WhisperResponse) => void;
  onmessage: ((event: MessageEvent<WhisperRequest>) => void) | null;
};

/** Install in a dedicated module worker; terminate that worker to release its model. */
export const installWhisperWorker = (scope: WorkerScope, wasmBaseUrl?: string) => {
  env.allowLocalModels = false;
  if (wasmBaseUrl) env.backends.onnx.wasm.wasmPaths = wasmBaseUrl;
  // A single inference thread keeps Whisper usable without cross-origin isolation.
  env.backends.onnx.wasm.numThreads = 1;
  let instance: ReturnType<typeof pipeline> | undefined;
  const load = () => {
    instance ??= pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
      quantized: true,
      progress_callback: (event: unknown) => {
        const progress = (event as { progress?: number }).progress;
        if (typeof progress === 'number')
          scope.postMessage({ type: 'progress', progress: progress / 100 });
      },
    });
    return instance;
  };
  scope.onmessage = async ({ data }) => {
    try {
      const recognizer = await load();
      if (data.type === 'warmup') scope.postMessage({ type: 'ready' });
      else {
        const output = await (
          recognizer as (audio: Float32Array, options: object) => Promise<{ text: string }>
        )(data.audio, { top_k: 0, do_sample: false });
        scope.postMessage({ type: 'transcript', id: data.id, text: output.text });
      }
    } catch (error) {
      scope.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
};
