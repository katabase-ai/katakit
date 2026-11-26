import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import type { TranscriptionModelId } from './catalog';
import { createMicrophoneTranscriber, type MicrophoneOptions } from './microphone';
import type { TranscriptionSegment, TranscriptionState } from './types';
import mitt, { type Emitter } from 'mitt';
import { useStableFn } from './utils/useStableFn';

/** What one microphone session writes to, such as a transcript-ingestion runtime. */
export type MicrophoneSink = {
  ingestSegment: MicrophoneOptions['onFinal'];
  updateProvisional?: MicrophoneOptions['onProvisional'];
  /** Called once capture has drained and every final segment has been delivered. */
  flush?: () => void;
  close: () => void;
};

type MicrophoneEvents = {
  level: number;
  utterance: TranscriptionSegment;
  provisionalUtterance: TranscriptionSegment;
  flush: void;
  close: void;
};

/**
 * Own one microphone transcriber and the sink it writes to for a component's lifetime.
 * Unmount stops capture, waits for pending results, releases the model, and only then
 * closes the sink, so the last words are never written to a closed sink.
 *
 * Pass a stable `createSink`. A new function, or a new `model`, ends the session and
 * starts another with a fresh sink.
 */
export const useMicrophoneTranscriber = ({
  model,
}: {
  model?: TranscriptionModelId;
} = {}) => {
  const [state, setState] = useState<TranscriptionState>({ phase: 'idle' });
  const session = useRef<{
    transcriber: ReturnType<typeof createMicrophoneTranscriber>;
    phase: TranscriptionState['phase'];
  }>(undefined);

  const emitterRef = useRef<Emitter<MicrophoneEvents>>(mitt());

  useEffect(() => {
    let mounted = true;

    const current: NonNullable<typeof session.current> = {
      phase: 'idle',
      transcriber: createMicrophoneTranscriber({
        model,
        onState: next => {
          current.phase = next.phase;
          if (mounted) setState(next);
        },
        onLevel: next => {
          if (mounted) {
            emitterRef.current.emit('level', next);
          }
        },
        onFinal: utterance => {
          emitterRef.current.emit('utterance', utterance);
        },
        onProvisional: utterance => {
          emitterRef.current.emit('provisionalUtterance', utterance);
        },
        onStop: () => {
          emitterRef.current.emit('flush');
        },
      }),
    };
    session.current = current;
    setState({ phase: 'idle' });
    return () => {
      mounted = false;
      session.current = undefined;
      void (async () => {
        try {
          try {
            if (current.phase === 'running') await current.transcriber.stop();
          } finally {
            await current.transcriber.dispose();
          }
        } catch (error) {
          reportError(error);
        } finally {
          emitterRef.current.emit('close');
        }
      })();
    };
  }, [model]);

  /** Start or stop listening. Call from a user action; failures arrive in `state.error`. */
  const toggle = useCallback(async () => {
    const current = session.current;
    if (!current) return;
    try {
      await (current.phase === 'running'
        ? current.transcriber.stop()
        : current.transcriber.start());
    } catch {
      // The transcriber already reported this failure through onState.
    }
  }, []);

  return {
    state,
    listening: state.phase === 'running',
    /** True while loading, starting, or stopping; disable the toggle meanwhile. */
    busy: ['loading', 'starting', 'stopping'].includes(state.phase),
    toggle,
    emitter: emitterRef.current,
  };
};

export const MicrophoneTranscriberContext = createContext<ReturnType<
  typeof useMicrophoneTranscriber
> | null>(null);

export const useMicrophoneTranscriberCallbacks = (
  microphoneTranscriber: ReturnType<typeof useMicrophoneTranscriber>,
  {
    onLevelChange,
    onUtterance,
    onProvisionalUtterance,
    onFlush,
    onClose,
  }: {
    onLevelChange?: (level: number) => void;
    onUtterance?: (utterance: TranscriptionSegment) => void;
    onProvisionalUtterance?: (utterance: TranscriptionSegment) => void;
    onFlush?: () => void;
    onClose?: () => void;
  }
) => {
  const stableOnLevelChange = useStableFn(onLevelChange ?? (() => {}));
  const stableOnUtterance = useStableFn(onUtterance ?? (() => {}));
  const stableOnProvisionalUtterance = useStableFn(onProvisionalUtterance ?? (() => {}));
  const stableOnFlush = useStableFn(onFlush ?? (() => {}));
  const stableOnClose = useStableFn(onClose ?? (() => {}));

  useEffect(() => {
    microphoneTranscriber.emitter.on('level', stableOnLevelChange);
    microphoneTranscriber.emitter.on('utterance', stableOnUtterance);
    microphoneTranscriber.emitter.on('provisionalUtterance', stableOnProvisionalUtterance);
    microphoneTranscriber.emitter.on('flush', stableOnFlush);
    microphoneTranscriber.emitter.on('close', stableOnClose);
    return () => {
      microphoneTranscriber.emitter.off('level', stableOnLevelChange);
      microphoneTranscriber.emitter.off('utterance', stableOnUtterance);
      microphoneTranscriber.emitter.off('provisionalUtterance', stableOnProvisionalUtterance);
      microphoneTranscriber.emitter.off('flush', stableOnFlush);
      microphoneTranscriber.emitter.off('close', stableOnClose);
    };
  }, [microphoneTranscriber]);
};
