import type {
  SpeechState,
  EngineSession,
  SpeechCallbacks,
  Transcriber,
  SpeechEngine,
} from './types';
import { SpeechError, speechError } from './errors';
export { SpeechError } from './errors';
export type { SpeechErrorCode } from './errors';

export type {
  SpeechSegment,
  SpeechState,
  SpeechCallbacks,
  Transcriber,
  SpeechEngine,
  EngineEvents,
  EngineSession,
} from './types';

/** Owns recognition resources; the caller owns its audio source and feeds mono PCM. */
export const createTranscriber = (
  options: { engine: SpeechEngine } & SpeechCallbacks
): Transcriber => {
  let provider: EngineSession | undefined;
  let active = false;
  let disposed = false;
  let failure: SpeechError | undefined;
  let queue = Promise.resolve();
  let disposal: Promise<void> | undefined;
  let phase: SpeechState['phase'] = 'idle';

  const update = (state: SpeechState) => {
    phase = state.phase;
    if (!disposed) options.onState?.(state);
  };
  const serialize = (action: () => Promise<void>) => {
    const previous = queue;
    const result = (async () => {
      await previous;
      await action();
    })();
    queue = (async () => {
      try {
        await result;
      } catch {
        // Keep the lifecycle queue usable after a rejected operation.
      }
    })();
    return result;
  };
  const finish = async () => {
    if (!active) return;
    active = false;
    if (!failure) update({ phase: 'stopping' });
    try {
      await provider?.stop();
    } finally {
      options.onStop?.();
    }
    if (!failure) update({ phase: 'ready' });
  };
  const release = () => {
    const current = provider;
    provider = undefined;
    current?.close();
  };
  const fail = (error: unknown) => {
    if (failure) return;
    failure = speechError(error, 'recognition-failed');
    update({ phase: 'error', error: failure });
    // Async worker failures also stop recognition and release the failed model.
    void (async () => {
      try {
        await serialize(async () => {
          try {
            await finish();
          } finally {
            release();
          }
        });
      } catch {
        // The original failure was already reported through onState.
      }
    })();
  };
  const run = (action: () => Promise<void>) =>
    serialize(async () => {
      try {
        await action();
      } catch (error) {
        fail(error);
        throw error;
      }
    });
  const load = async () => {
    if (disposed)
      throw new SpeechError(
        'disposed',
        'This transcriber has been disposed. Create a new instance.'
      );
    if (provider) return;
    failure = undefined;
    update({ phase: 'loading' });
    const events = {
      onProgress: (progress?: number) => {
        if (phase === 'loading') update({ phase: 'loading', progress });
      },
      onProvisional: (text: string) => {
        if (!disposed && !failure) options.onProvisional?.(text);
      },
      onFinal: (segment: Parameters<SpeechCallbacks['onFinal']>[0]) => {
        if (!disposed && !failure) options.onFinal(segment);
      },
      onError: fail,
    };
    try {
      provider = await options.engine(events);
    } catch (error) {
      throw speechError(error, 'model-load-failed');
    }
    if (!failure) update({ phase: 'ready' });
  };

  return {
    load: () => run(load),
    start: startOptions =>
      run(async () => {
        if (disposed)
          throw new SpeechError(
            'disposed',
            'This transcriber has been disposed. Create a new instance.'
          );
        if (active) return;
        await load();
        if (disposed) return;
        update({ phase: 'starting' });
        active = true;
        provider!.start(startOptions?.sourceId ?? crypto.randomUUID());
        if (failure) throw failure;
        update({ phase: 'running' });
      }),
    write: (audio, sampleRate) => {
      if (disposed) throw new SpeechError('disposed', 'This transcriber has been disposed.');
      if (!active || failure) return;
      try {
        if (!Number.isFinite(sampleRate) || sampleRate <= 0)
          throw new Error('sampleRate must be a positive number');
        provider!.write(audio, sampleRate);
      } catch (error) {
        fail(error);
        throw error;
      }
    },
    stop: () => run(finish),
    dispose: () => {
      if (!disposed) update({ phase: 'disposed' });
      disposed = true;
      disposal ??= serialize(async () => {
        try {
          await finish();
        } finally {
          release();
        }
      });
      return disposal;
    },
  };
};
