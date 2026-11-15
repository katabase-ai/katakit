import { createTranscriber } from './index';
import { moonshine } from './moonshine';
import { whisper } from './whisper';
import { speechModels, type SpeechModelId } from './catalog';
import { checkBrowserSupport, defaultSpeechAssetsBaseUrl, speechAssetUrl } from './browserRuntime';
import { speechError } from './errors';
import type { SpeechCallbacks, SpeechEngine } from './types';

export { speechModels, defaultSpeechAssetsBaseUrl };
export type { SpeechModelId };

export type BrowserTranscriberOptions = SpeechCallbacks & {
  model?: SpeechModelId;
  /** Directory served/copied by speechAssetsPlugin or copySpeechAssets. */
  assetsBaseUrl?: string;
};

/** Browser engine setup for callers that already have mono PCM. */
export const createBrowserTranscriber = (options: BrowserTranscriberOptions) => {
  const model = options.model ?? 'moonshine-small';
  const base = options.assetsBaseUrl ?? defaultSpeechAssetsBaseUrl;
  const engine: SpeechEngine = async events => {
    checkBrowserSupport(model);
    try {
      return await (
        model === 'whisper-tiny'
          ? whisper({
              createWorker: () =>
                new Worker(speechAssetUrl(base, 'whisper-worker.js'), { type: 'module' }),
            })
          : moonshine({
              model:
                model === 'moonshine-tiny'
                  ? 'tiny'
                  : model === 'moonshine-medium'
                    ? 'medium'
                    : 'small',
              loadSdk: () => import(/* @vite-ignore */ speechAssetUrl(base, 'moonshine/index.js')),
            })
      )(events);
    } catch (error) {
      throw speechError(error, 'model-load-failed');
    }
  };
  return createTranscriber({ ...options, engine });
};
