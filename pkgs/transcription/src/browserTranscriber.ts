import { createTranscriber } from './index';
import { moonshine } from './moonshine';
import { whisper } from './whisper';
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
export const createBrowserEngine = (options: BrowserTranscriberOptions): TranscriptionEngine => {
  const model = options.model ?? 'moonshine-small';
  const base = options.assetsBaseUrl ?? defaultTranscriptionAssetsBaseUrl;
  return async events => {
    checkBrowserSupport(model);
    try {
      return await (
        model === 'whisper-tiny'
          ? whisper({
              createWorker: () =>
                new Worker(transcriptionAssetUrl(base, 'whisper-worker.js'), { type: 'module' }),
            })
          : moonshine({
              model:
                model === 'moonshine-tiny'
                  ? 'tiny'
                  : model === 'moonshine-medium'
                    ? 'medium'
                    : 'small',
              loadSdk: () =>
                import(/* @vite-ignore */ transcriptionAssetUrl(base, 'moonshine/index.js')),
            })
      )(events);
    } catch (error) {
      throw transcriptionError(error, 'model-load-failed');
    }
  };
};

export const createBrowserTranscriber = (options: BrowserTranscriberOptions) =>
  createTranscriber({ ...options, engine: createBrowserEngine(options) });
