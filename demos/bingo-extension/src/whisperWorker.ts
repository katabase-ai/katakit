import { env, pipeline } from '@xenova/transformers';
import type { WhisperRequest, WhisperResponse } from './whisperProtocol';

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
const send = (message: WhisperResponse) => self.postMessage(message);
let instance: ReturnType<typeof pipeline> | undefined;

self.onmessage = async ({ data }: MessageEvent<WhisperRequest>) => {
  try {
    if (data.type === 'warmup') env.backends.onnx.wasm.wasmPaths = data.wasmPath;
    instance ??= pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
      quantized: true,
      progress_callback: (event: unknown) => {
        const progress = (event as { progress?: number }).progress;
        if (typeof progress === 'number') send({ type: 'progress', progress: progress / 100 });
      },
    });
    const recognizer = await instance;
    if (data.type === 'warmup') return send({ type: 'ready' });
    const output = await (
      recognizer as (audio: Float32Array, options: object) => Promise<{ text: string }>
    )(data.audio, { top_k: 0, do_sample: false });
    send({ type: 'transcript', id: data.id, text: output.text });
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
