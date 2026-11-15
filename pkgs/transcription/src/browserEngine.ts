import { moonshine } from './moonshine';
import { whisper } from './whisper';
import type { TranscriptionModelId } from './catalog';
import { checkBrowserSupport, transcriptionAssetUrl } from './browserRuntime';
import { transcriptionError } from './errors';
import type { TranscriptionEngine } from './types';

/** Load a provider inside its execution context; all SDK details stay in the utility. */
export const browserEngine =
  (model: TranscriptionModelId, assetsBaseUrl: string): TranscriptionEngine =>
  async events => {
    checkBrowserSupport(model);
    try {
      return await (
        model === 'whisper-tiny'
          ? whisper({
              createWorker: () =>
                new Worker(transcriptionAssetUrl(assetsBaseUrl, 'whisper-worker.js'), {
                  type: 'module',
                }),
            })
          : moonshine({
              model:
                model === 'moonshine-tiny'
                  ? 'tiny'
                  : model === 'moonshine-medium'
                    ? 'medium'
                    : 'small',
              loadSdk: () =>
                import(
                  /* @vite-ignore */ transcriptionAssetUrl(assetsBaseUrl, 'moonshine/index.js')
                ),
            })
      )(events);
    } catch (error) {
      throw transcriptionError(error, 'model-load-failed');
    }
  };
