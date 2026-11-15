import { createTranscriber, type Transcriber } from '@katakit/transcription';
import { moonshine } from '@katakit/transcription/moonshine';
import type { MoonshineRequest, MoonshineResponse } from './moonshineProtocol';

const send = (message: MoonshineResponse) => self.postMessage(message);
let transcriber: Transcriber | undefined;
let reportedError: unknown;
self.onmessage = async ({ data }: MessageEvent<MoonshineRequest>) => {
  try {
    if (data.type === 'warmup') {
      await transcriber?.dispose();
      transcriber = createTranscriber({
        engine: moonshine({
          model: 'tiny',
          loadSdk: () => import(/* @vite-ignore */ data.assetUrl),
        }),
        onState: state => {
          if (state.phase === 'loading') send({ type: 'progress', progress: state.progress ?? 0 });
          if (state.phase === 'error') {
            reportedError = state.error;
            send({ type: 'error', message: state.error?.message ?? 'Recognition failed.' });
          }
        },
        onFinal: segment => send({ type: 'final', segment }),
      });
      await transcriber.load();
      send({ type: 'ready' });
    } else if (data.type === 'start') {
      if (!transcriber) throw new Error('The model has not loaded.');
      await transcriber.start({ sourceId: data.sourceId });
    } else if (data.type === 'audio') transcriber?.write(data.samples, 16_000);
    else if (data.type === 'stop') {
      await transcriber?.stop();
      send({ type: 'stopped' });
    }
  } catch (error) {
    // Lifecycle failures have already been reported by onState. Still report errors
    // outside the transcriber (such as a start before warmup).
    if (error !== reportedError)
      send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
