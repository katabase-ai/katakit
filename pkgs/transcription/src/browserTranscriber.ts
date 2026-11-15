import { createTranscriber } from './index';
import { workerEngine } from './workerEngine';
import { browserEngine } from './browserEngine';
import { transcriptionModels, type TranscriptionModelId } from './catalog';
import {
  checkBrowserSupport,
  defaultTranscriptionAssetsBaseUrl,
  transcriptionAssetUrl,
} from './browserRuntime';
import { transcriptionError } from './errors';
import type { TranscriptionCallbacks, TranscriptionEngine } from './types';

export { transcriptionModels, defaultTranscriptionAssetsBaseUrl };
export type { TranscriptionModelId };

export type BrowserTranscriberOptions = TranscriptionCallbacks & {
  model?: TranscriptionModelId;
  /** Directory served/copied by transcriptionAssetsPlugin or copyTranscriptionAssets. */
  assetsBaseUrl?: string;
};

/** Browser engine setup for callers that already have mono PCM. */
export const createBrowserTranscriber = (options: BrowserTranscriberOptions) => {
  const model = options.model ?? 'moonshine-small';
  const base = options.assetsBaseUrl ?? defaultTranscriptionAssetsBaseUrl;
  const engine: TranscriptionEngine = async events => {
    checkBrowserSupport(model);
    try {
      return await (
        model === 'whisper-tiny'
          ? browserEngine(model, base)
          : workerEngine({
              model,
              assetsBaseUrl: transcriptionAssetUrl(base, ''),
              createWorker: () =>
                new Worker(transcriptionAssetUrl(base, 'transcription-worker.js'), {
                  type: 'module',
                }),
            })
      )(events);
    } catch (error) {
      throw transcriptionError(error, 'model-load-failed');
    }
  };
  return createTranscriber({ ...options, engine });
};
