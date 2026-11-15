import type { Stream, Transcriber } from '@moonshine-ai/moonshine-wasm';
import type { MoonshineRequest, MoonshineResponse } from './moonshineProtocol';

const send = (message: MoonshineResponse) => self.postMessage(message);
let model: Transcriber | undefined;
let stream: Stream | undefined;

self.onmessage = async ({ data }: MessageEvent<MoonshineRequest>) => {
  try {
    if (data.type === 'warmup') {
      // The SDK's ESM, worker and WASM files must be siblings under the extension origin.
      const sdk: typeof import('@moonshine-ai/moonshine-wasm') = await import(
        /* @vite-ignore */ data.assetUrl
      );
      model = await sdk.Transcriber.load({
        language: 'en',
        modelArch: sdk.ModelArch.TinyStreaming,
        onProgress: (bytes, total) =>
          send({ type: 'progress', progress: total ? bytes / total : 0 }),
      });
      send({ type: 'ready' });
    } else if (data.type === 'start') {
      if (!model) throw new Error('Moonshine model is not loaded.');
      stream?.close();
      stream = model.createStream();
      stream.addListener({
        onLineStarted: ({ line }) => send({ type: 'provisional', text: line.text }),
        onLineTextChanged: ({ line }) => send({ type: 'provisional', text: line.text }),
        onLineCompleted: ({ line }) => send({ type: 'final', line }),
        onError: ({ error }) => send({ type: 'error', message: String(error) }),
      });
      stream.start();
    } else if (data.type === 'audio') {
      stream?.addAudio(data.samples, 16_000);
      stream?.transcribe();
    } else if (data.type === 'stop') {
      stream?.stop();
      stream?.close();
      stream = undefined;
      send({ type: 'stopped' });
    }
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
