import {
  createTranscriptionModel,
  type ModelState,
  type MoonshineOptions,
  type TranscriptionCallbacks,
  type WhisperOptions,
} from '@katakit/transcription/models';
import { createMicrophoneCapture } from './createMicrophoneCapture';
import { createAudioLevelReporter } from '@katakit/site-ui/audio-level';

export type InputState = Omit<ModelState, 'phase'> & {
  phase: Exclude<ModelState['phase'], 'running'> | 'recording';
};

/** The host owns microphone permission and capture; the shared utility owns recognition. */
export const createMicrophoneInput = (
  params: Omit<TranscriptionCallbacks, 'onState'> & {
    model: MoonshineOptions | WhisperOptions;
    onState: (state: InputState) => void;
    onLevel?: (level: number) => void;
  }
) => {
  let capture: ReturnType<typeof createMicrophoneCapture> | undefined;
  let starting: Promise<void> | undefined;
  let stopping: Promise<void> | undefined;
  let disposal: Promise<void> | undefined;
  let disposed = false;
  let phase: InputState['phase'] = 'idle';

  const update = (state: InputState) => {
    phase = state.phase;
    if (!disposed) params.onState(state);
  };
  const fail = (error: unknown) => {
    update({ phase: 'error', error: error instanceof Error ? error.message : String(error) });
    void stop();
  };
  const model = createTranscriptionModel({
    ...params.model,
    onFinal: segment => {
      if (!disposed) params.onFinal(segment);
    },
    onProvisional: text => {
      if (!disposed) params.onProvisional?.(text);
    },
    onStop: params.onStop,
    onState: state => {
      if (state.phase === 'loading') update({ ...state, phase: 'loading' });
      if (state.phase === 'error') fail(state.error);
    },
  });

  const start = () => {
    if (disposed || starting || stopping || phase === 'recording') return Promise.resolve();
    update({ phase: 'starting' });
    starting = (async () => {
      try {
        await model.start();
        if (disposed || phase === 'error') return;
        update({ phase: 'starting' });
        const reportLevel = params.onLevel
          ? createAudioLevelReporter(params.onLevel, 16_000)
          : undefined;
        capture = createMicrophoneCapture((audio, sampleRate) => {
          if (!disposed) reportLevel?.(audio);
          model.write(audio, sampleRate);
        }, fail);
        await capture.start();
        if (!disposed && !hasError()) update({ phase: 'recording' });
      } catch (error) {
        fail(error);
      } finally {
        starting = undefined;
      }
    })();
    return starting;
  };
  const hasError = () => phase === 'error';
  const stop = () => {
    if (stopping) return stopping;
    stopping = (async () => {
      if (!disposed && phase !== 'error') update({ phase: 'stopping' });
      try {
        await starting;
        try {
          // Capture flushes its last PCM buffer before recognition drains and onStop fires.
          await capture?.stop();
        } finally {
          capture = undefined;
          await model.stop();
        }
        if (!disposed && phase !== 'error') update({ phase: 'ready' });
      } catch (error) {
        update({ phase: 'error', error: error instanceof Error ? error.message : String(error) });
      } finally {
        stopping = undefined;
      }
    })();
    return stopping;
  };

  return {
    start,
    stop,
    dispose: () => {
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
