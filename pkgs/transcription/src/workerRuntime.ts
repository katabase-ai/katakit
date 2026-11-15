import { createTranscriber } from './index';
import { browserEngine } from './browserEngine';
import { transcriptionError } from './errors';
import type { Transcriber } from './types';
import type { TranscriptionWorkerRequest, TranscriptionWorkerResponse } from './workerProtocol';

type WorkerScope = {
  postMessage: (message: TranscriptionWorkerResponse) => void;
  onmessage: ((event: MessageEvent<TranscriptionWorkerRequest>) => void) | null;
};

/** Internal module-worker entry. All transport and provider knowledge is library-owned. */
export const installTranscriptionWorker = (scope: WorkerScope) => {
  let transcriber: Transcriber | undefined;
  let queue = Promise.resolve();
  let failed = false;
  const fail = (error: unknown) => {
    if (failed) return;
    failed = true;
    const cause = transcriptionError(error, 'recognition-failed');
    scope.postMessage({ type: 'error', code: cause.code, message: cause.message });
  };
  scope.onmessage = ({ data }) => {
    const previous = queue;
    queue = (async () => {
      await previous;
      try {
        if (data.type === 'load') {
          failed = false;
          await transcriber?.dispose();
          transcriber = createTranscriber({
            engine: browserEngine(data.model, data.assetsBaseUrl),
            onState: state => {
              if (state.phase === 'loading')
                scope.postMessage({ type: 'progress', progress: state.progress });
              if (state.phase === 'error') fail(state.error);
            },
            onProvisional: text => scope.postMessage({ type: 'provisional', text }),
            onFinal: segment => scope.postMessage({ type: 'final', segment }),
          });
          await transcriber.load();
        } else if (!failed) {
          if (!transcriber)
            throw new Error('Load the transcription model before starting a session.');
          if (data.type === 'start') await transcriber.start({ sourceId: data.sourceId });
          else if (data.type === 'audio') transcriber.write(data.samples, data.sampleRate);
          else if (data.type === 'stop') await transcriber.stop();
          else if (data.type === 'dispose') {
            await transcriber.dispose();
            transcriber = undefined;
          }
        }
        if ('id' in data && !failed) scope.postMessage({ type: 'complete', id: data.id });
      } catch (error) {
        fail(error);
      }
    })();
  };
};
