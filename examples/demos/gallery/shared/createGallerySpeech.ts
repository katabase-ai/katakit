import {
  createMicrophoneTranscriber,
  defaultTranscriptionModel,
  type MicrophoneOptions,
  type MicrophoneTranscriber,
  type TranscriptionModelId,
} from '@katakit/transcription/browser';
import type { TranscriptionState } from '@katakit/transcription';

/** Each attachment owns its conversation/runtime; the gallery owns capture and recognition. */
export type GalleryInputSink = {
  ingestSegment: MicrophoneOptions['onFinal'];
  updateProvisional: NonNullable<MicrophoneOptions['onProvisional']>;
  flush: () => void;
  close: () => void;
};

type Snapshot = {
  model: TranscriptionModelId;
  input: TranscriptionState;
  level: number;
  transitioning: boolean;
  attached: boolean;
  blocked: boolean;
  /** Successful microphone start for the current model, retained only for this host session. */
  microphoneVerified: boolean;
  /** One explicit microphone start, including its download and permission handoff. */
  starting: boolean;
  error?: string;
};

/**
 * Serialize input handoffs while retaining the loaded model. Runtime factories are deferred
 * until the outgoing transcriber has drained and its sink has closed. Construction is inert.
 */
export const createGallerySpeech = ({
  createTranscriber = createMicrophoneTranscriber,
}: { createTranscriber?: typeof createMicrophoneTranscriber } = {}) => {
  let snapshot: Snapshot = {
    model: defaultTranscriptionModel,
    input: { phase: 'idle' },
    level: 0,
    transitioning: false,
    attached: false,
    blocked: false,
    microphoneVerified: false,
    starting: false,
  };
  let listeners: (() => void)[] = [];
  const update = (patch: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener());
  };
  let queue = Promise.resolve();
  let helper: MicrophoneTranscriber | undefined;
  let active: { sink: GalleryInputSink; cancelled: boolean } | undefined;
  let capture: { sink: GalleryInputSink; sourceId: string } | undefined;
  let disposed = false;
  let wantsRecording = false;
  let pendingDisposal: Promise<void> | undefined;
  const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
  const enqueue = <T>(action: () => Promise<T>) => {
    const previous = queue;
    const operation = (async () => {
      await previous;
      update({ transitioning: true });
      try {
        return await action();
      } catch (error) {
        update({ error: message(error), microphoneVerified: false });
        return undefined;
      } finally {
        update({ transitioning: false });
      }
    })();
    queue = (async () => {
      await operation;
    })();
    return operation;
  };
  const getHelper = () => {
    if (helper) return helper;
    const current = createTranscriber({
      model: snapshot.model,
      onState: input => {
        if (helper === current)
          update({
            input,
            microphoneVerified:
              input.phase === 'running' || (input.phase !== 'error' && snapshot.microphoneVerified),
          });
      },
      onLevel: level => {
        if (helper === current) update({ level });
      },
      onFinal: segment => {
        if (helper === current && capture?.sourceId === segment.sourceId)
          capture.sink.ingestSegment(segment);
      },
      onProvisional: text => {
        if (helper === current) capture?.sink.updateProvisional(text);
      },
      onStop: () => {
        if (helper === current) capture?.sink.flush();
      },
    });
    helper = current;
    return current;
  };
  // stop() queues behind loading in the utility. Dispose cancels a pending start immediately,
  // so navigating away during model download cannot later request microphone permission.
  const cancelLoading = () => {
    if (!helper || !['loading', 'starting'].includes(snapshot.input.phase)) return;
    const current = helper;
    helper = undefined;
    pendingDisposal = (async () => {
      try {
        await current.dispose();
      } catch (error) {
        update({ error: message(error), blocked: true });
      }
    })();
    update({ input: { phase: 'idle' }, level: 0, microphoneVerified: false });
  };
  const finish = async () => {
    await pendingDisposal;
    pendingDisposal = undefined;
    try {
      await helper?.stop();
    } finally {
      capture?.sink.flush();
      capture = undefined;
      update({ level: 0 });
    }
  };
  const leave = async () => {
    const outgoing = active;
    try {
      await finish();
    } finally {
      outgoing?.sink.close();
      active = undefined;
      update({ attached: false });
    }
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter(current => current !== listener);
      };
    },
    attach: <T extends GalleryInputSink>(create: () => T) => {
      const lease = { cancelled: false, sink: undefined as T | undefined };
      const ready = enqueue(async () => {
        await leave();
        if (disposed || lease.cancelled || snapshot.blocked) return undefined;
        const sink = create();
        lease.sink = sink;
        active = { sink, cancelled: false };
        update({ attached: true });
        return sink;
      });
      return {
        ready,
        release: () => {
          lease.cancelled = true;
          if (lease.sink && active?.sink === lease.sink) {
            active.cancelled = true;
            update({ attached: false });
            wantsRecording = false;
            if (snapshot.starting) cancelLoading();
          }
          return enqueue(async () => {
            if (lease.sink && active?.sink === lease.sink) await leave();
          });
        },
      };
    },
    load: () =>
      enqueue(async () => {
        if (disposed || snapshot.blocked) return;
        update({ error: undefined });
        const current = getHelper();
        try {
          await current.load();
        } catch (error) {
          if (helper === current) throw error;
        }
      }),
    start: () => {
      wantsRecording = true;
      const requested = active;
      return enqueue(async () => {
        if (
          disposed ||
          snapshot.blocked ||
          !wantsRecording ||
          !requested ||
          active !== requested ||
          requested.cancelled
        )
          return;
        if (snapshot.input.phase === 'running') return;
        update({ error: undefined });
        const current = getHelper();
        capture = { sink: requested.sink, sourceId: crypto.randomUUID() };
        update({ starting: true });
        try {
          await current.start({ sourceId: capture.sourceId });
        } catch (error) {
          if (helper === current) throw error;
        } finally {
          update({ starting: false });
        }
      });
    },
    stop: () => {
      wantsRecording = false;
      if (snapshot.starting) cancelLoading();
      return enqueue(finish);
    },
    // Explicit cancellation also covers preload; ordinary navigation may retain a preload.
    cancel: () => {
      wantsRecording = false;
      cancelLoading();
      return enqueue(finish);
    },
    select: (model: TranscriptionModelId) =>
      enqueue(async () => {
        if (
          disposed ||
          snapshot.blocked ||
          model === snapshot.model ||
          ['running', 'starting', 'stopping'].includes(snapshot.input.phase)
        )
          return;
        await finish();
        try {
          await helper?.dispose();
        } catch (error) {
          update({ blocked: true });
          throw error;
        }
        helper = undefined;
        update({
          model,
          input: { phase: 'idle' },
          level: 0,
          error: undefined,
          microphoneVerified: false,
        });
      }),
    dispose: () => {
      disposed = true;
      wantsRecording = false;
      cancelLoading();
      return enqueue(async () => {
        try {
          await leave();
        } finally {
          await helper?.dispose();
          helper = undefined;
          update({ input: { phase: 'disposed' }, level: 0, microphoneVerified: false });
        }
      });
    },
  };
};
