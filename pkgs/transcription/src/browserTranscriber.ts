import { createTranscriber } from './index';
import { workerEngine } from './workerEngine';
import { createProviderEngine } from './providerEngine';
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

type BrowserEngineOptions = {
  model?: TranscriptionModelId;
  /** Directory served/copied by transcriptionAssetsPlugin or copyTranscriptionAssets. */
  assetsBaseUrl?: string;
};

export type BrowserTranscriberOptions = TranscriptionCallbacks & BrowserEngineOptions;

/** Choose the browser execution context and own its packaged recognition worker. */
export const createBrowserRecognitionEngine = (
  options: BrowserEngineOptions
): TranscriptionEngine => {
  const model = options.model ?? defaultTranscriptionModel;
  const base = options.assetsBaseUrl ?? defaultTranscriptionAssetsBaseUrl;
  return async events => {
    checkBrowserSupport(model);
    return (
      model === 'whisper-tiny'
        ? createProviderEngine(model, base)
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
  createTranscriber({ ...options, engine: createBrowserRecognitionEngine(options) });
