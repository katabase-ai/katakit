import { createTranscriber } from './index';
import { workerEngine } from './workerEngine';
import { browserEngine } from './browserEngine';
import {
  defaultTranscriptionModel,
  transcriptionModels,
  type TranscriptionModelId,
} from './catalog';
import {
  checkBrowserSupport,
  defaultTranscriptionAssetsBaseUrl,
  transcriptionAssetUrl,
} from './browserRuntime';
import type { TranscriptionCallbacks, TranscriptionEngine } from './types';

export { defaultTranscriptionModel, transcriptionModels, defaultTranscriptionAssetsBaseUrl };
export type { TranscriptionModelId };

export type BrowserTranscriberOptions = TranscriptionCallbacks & {
  model?: TranscriptionModelId;
  /** Directory served/copied by transcriptionAssetsPlugin or copyTranscriptionAssets. */
  assetsBaseUrl?: string;
};

/** Browser engine setup for callers that already have mono PCM. */
export const createBrowserEngine = (options: BrowserTranscriberOptions): TranscriptionEngine => {
  const model = options.model ?? defaultTranscriptionModel;
  const base = options.assetsBaseUrl ?? defaultTranscriptionAssetsBaseUrl;
  return async events => {
    checkBrowserSupport(model);
    return (
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
  };
};

export const createBrowserTranscriber = (options: BrowserTranscriberOptions) =>
  createTranscriber({ ...options, engine: createBrowserEngine(options) });
