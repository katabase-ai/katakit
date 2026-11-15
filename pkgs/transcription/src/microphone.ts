import {
  createBrowserRecognitionEngine,
  type BrowserTranscriberOptions,
} from './browserTranscriber';
import {
  checkBrowserSupport,
  defaultTranscriptionAssetsBaseUrl,
  transcriptionAssetUrl,
} from './browserRuntime';
import { createMicrophoneCapture } from './microphoneCapture';
import { createTranscriber } from './index';
import { transcriptionError } from './errors';
import { defaultTranscriptionModel } from './catalog';
import type { Transcriber, TranscriptionEngine } from './types';

export type MicrophoneOptions = BrowserTranscriberOptions & {
  /** Approximate activity in [0, 1], emitted roughly ten times per second. */
  onLevel?: (level: number) => void;
};

export type MicrophoneTranscriber = Omit<Transcriber, 'write'>;

/** Capture is an engine adapter: the PCM transcriber owns the only lifecycle. */
export const createMicrophoneTranscriber = (options: MicrophoneOptions): MicrophoneTranscriber => {
  let disposed = false;
  const recognitionEngine = createBrowserRecognitionEngine(options);
  const engine: TranscriptionEngine = async events => {
    checkBrowserSupport(options.model ?? defaultTranscriptionModel, true);
    const model = await recognitionEngine(events);
    let capture: ReturnType<typeof createMicrophoneCapture> | undefined;
    return {
      start: async sourceId => {
        await model.start(sourceId);
        let energy = 0;
        let count = 0;
        capture = createMicrophoneCapture(
          transcriptionAssetUrl(
            options.assetsBaseUrl ?? defaultTranscriptionAssetsBaseUrl,
            'microphone-worklet.js'
          ),
          (audio, sampleRate) => {
            if (!disposed && options.onLevel) {
              for (const sample of audio) energy += sample * sample;
              count += audio.length;
              if (count >= sampleRate / 10) {
                options.onLevel(
                  Math.min(1, Math.max(0, (Math.sqrt(energy / count) - 0.003) / 0.12))
                );
                energy = 0;
                count = 0;
              }
            }
            model.write(audio, sampleRate);
          },
          events.onError
        );
        try {
          await capture.start();
        } catch (error) {
          const named = error as { name?: string };
          throw transcriptionError(
            error,
            named.name === 'NotAllowedError'
              ? 'microphone-permission-denied'
              : named.name === 'NotFoundError'
                ? 'microphone-unavailable'
                : 'recognition-failed'
          );
        }
      },
      write: model.write,
      stop: async () => {
        try {
          await capture?.stop();
        } finally {
          capture = undefined;
          try {
            await model.stop();
          } finally {
            if (!disposed) options.onLevel?.(0);
          }
        }
      },
      close: model.close,
    };
  };
  const transcriber = createTranscriber({ ...options, engine });
  return {
    load: transcriber.load,
    start: transcriber.start,
    stop: transcriber.stop,
    dispose: () => {
      disposed = true;
      return transcriber.dispose();
    },
  };
};
