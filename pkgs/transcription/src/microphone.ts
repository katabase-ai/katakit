import { createBrowserTranscriber, type BrowserTranscriberOptions } from './browserTranscriber';
import {
  checkBrowserSupport,
  defaultTranscriptionAssetsBaseUrl,
  transcriptionAssetUrl,
} from './browserRuntime';
import { createMicrophoneCapture } from './microphoneCapture';
import { TranscriptionError, transcriptionError } from './errors';
import type { TranscriptionState, Transcriber } from './types';

export type MicrophoneOptions = BrowserTranscriberOptions & {
  /** Approximate activity in [0, 1], emitted roughly ten times per second. */
  onLevel?: (level: number) => void;
};

export type MicrophoneTranscriber = Omit<Transcriber, 'write'>;

/** Owns microphone capture and browser recognition, without any UI framework. */
export const createMicrophoneTranscriber = (options: MicrophoneOptions): MicrophoneTranscriber => {
  let capture: ReturnType<typeof createMicrophoneCapture> | undefined;
  let starting: Promise<void> | undefined;
  let stopping: Promise<void> | undefined;
  let disposal: Promise<void> | undefined;
  let disposed = false;
  let failure: TranscriptionError | undefined;
  let phase: TranscriptionState['phase'] = 'idle';

  const update = (state: TranscriptionState) => {
    phase = state.phase;
    if (!disposed) options.onState?.(state);
  };
  const fail = (error: unknown) => {
    if (failure) return;
    failure = transcriptionError(error, 'recognition-failed');
    update({ phase: 'error', error: failure });
    void (async () => {
      try {
        await stop();
      } catch {
        /* The error is already available through onState. */
      }
    })();
  };
  const model = createBrowserTranscriber({
    ...options,
    onFinal: segment => {
      if (!disposed) options.onFinal(segment);
    },
    onProvisional: text => {
      if (!disposed) options.onProvisional?.(text);
    },
    onState: state => {
      if (state.phase === 'loading') update(state);
      if (state.phase === 'error') fail(state.error);
    },
  });
  const assertOpen = () => {
    if (disposed)
      throw new TranscriptionError(
        'disposed',
        'This microphone transcriber has been disposed. Create a new instance.'
      );
  };
  const load = async () => {
    assertOpen();
    if (starting) {
      await starting;
      return;
    }
    if (stopping) await stopping;
    if (phase === 'running') return;
    failure = undefined;
    try {
      checkBrowserSupport(options.model ?? 'moonshine-small', true);
      await model.load();
      if (!disposed && !failure && !starting && !stopping) update({ phase: 'ready' });
    } catch (error) {
      fail(error);
      throw failure;
    }
  };
  const start: Transcriber['start'] = startOptions => {
    if (starting) return starting;
    if (stopping) {
      const pending = stopping;
      return (async () => {
        await pending;
        await start(startOptions);
      })();
    }
    if (phase === 'running' && !disposed) return Promise.resolve();
    starting = (async () => {
      await Promise.resolve();
      try {
        assertOpen();
        failure = undefined;
        update({ phase: 'starting' });
        checkBrowserSupport(options.model ?? 'moonshine-small', true);
        await model.start(startOptions);
        if (disposed || failure) return;
        update({ phase: 'starting' });
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
          fail
        );
        await capture.start();
        if (!disposed && !failure) update({ phase: 'running' });
      } catch (error) {
        const named = error as { name?: string };
        fail(
          transcriptionError(
            error,
            named.name === 'NotAllowedError'
              ? 'microphone-permission-denied'
              : named.name === 'NotFoundError'
                ? 'microphone-unavailable'
                : 'recognition-failed'
          )
        );
        throw failure;
      } finally {
        starting = undefined;
      }
    })();
    return starting;
  };
  const stop = () => {
    if (stopping) return stopping;
    stopping = (async () => {
      if (!disposed && !failure) update({ phase: 'stopping' });
      try {
        try {
          await starting;
        } catch {
          /* Still release capture after failed startup. */
        }
        try {
          await capture?.stop();
        } finally {
          capture = undefined;
          await model.stop();
        }
        if (!disposed && !failure) update({ phase: 'ready' });
      } catch (error) {
        if (!failure) {
          failure = transcriptionError(error, 'recognition-failed');
          update({ phase: 'error', error: failure });
        }
        throw failure;
      } finally {
        if (!disposed) options.onLevel?.(0);
        stopping = undefined;
      }
    })();
    return stopping;
  };
  return {
    load,
    start,
    stop,
    dispose: () => {
      if (!disposed) update({ phase: 'disposed' });
      disposed = true;
      disposal ??= (async () => {
        try {
          await stop();
        } finally {
          await model.dispose();
        }
      })();
      return disposal;
    },
  };
};
