import { loadMoonshine, type MoonshineOptions } from './moonshine';
import { loadWhisper, type WhisperOptions } from './whisper';
import type { ModelState, Provider, TranscriptionCallbacks, TranscriptionModel } from './types';

export type { MoonshineOptions, WhisperOptions };
export type { ModelState, TranscriptionCallbacks, TranscriptionModel } from './types';

/** Owns recognition resources; the caller owns its audio source and feeds mono PCM. */
export const createTranscriptionModel = (
  options: (MoonshineOptions | WhisperOptions) & TranscriptionCallbacks
): TranscriptionModel => {
  let provider: Provider | undefined;
  let active = false;
  let disposed = false;
  let failure: Error | undefined;
  let queue = Promise.resolve();
  let disposal: Promise<void> | undefined;
  let phase: ModelState['phase'] = 'idle';

  const update = (state: ModelState) => {
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
    failure = error instanceof Error ? error : new Error(String(error));
    update({ phase: 'error', error: failure.message });
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
    if (provider || disposed) return;
    failure = undefined;
    update({ phase: 'loading' });
    const events = {
      onProgress: (progress?: number) => {
        if (phase === 'loading') update({ phase: 'loading', progress });
      },
      onProvisional: (text: string) => {
        if (!disposed && !failure) options.onProvisional?.(text);
      },
      onFinal: (segment: Parameters<TranscriptionCallbacks['onFinal']>[0]) => {
        if (!disposed && !failure) options.onFinal(segment);
      },
      onError: fail,
    };
    provider = await (options.provider === 'moonshine'
      ? loadMoonshine(options, events)
      : loadWhisper(options, events));
    if (!failure) update({ phase: 'ready' });
  };

  return {
    load: () => run(load),
    start: sourceId =>
      run(async () => {
        if (disposed || active) return;
        await load();
        if (disposed) return;
        update({ phase: 'starting' });
        active = true;
        provider!.start(sourceId ?? crypto.randomUUID());
        if (failure) throw failure;
        update({ phase: 'running' });
      }),
    write: (audio, sampleRate) => {
      if (disposed || !active || failure) return;
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
