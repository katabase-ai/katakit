import { useCallback, useEffect, useRef, useState } from 'react';
import type { TranscriptionModelId } from './catalog';
import { createMicrophoneTranscriber, type MicrophoneOptions } from './microphone';
import type { TranscriptionState } from './types';

/** What one microphone session writes to, such as a transcript-ingestion runtime. */
export type MicrophoneSink = {
  ingestSegment: MicrophoneOptions['onFinal'];
  updateProvisional?: MicrophoneOptions['onProvisional'];
  /** Called once capture has drained and every final segment has been delivered. */
  flush?: () => void;
  close: () => void;
};

/**
 * Own one microphone transcriber and the sink it writes to for a component's lifetime.
 * Unmount stops capture, waits for pending results, releases the model, and only then
 * closes the sink, so the last words are never written to a closed sink.
 *
 * Pass a stable `createSink`. A new function, or a new `model`, ends the session and
 * starts another with a fresh sink.
 */
export const useMicrophoneTranscriber = <Sink extends MicrophoneSink>({
  createSink,
  model,
}: {
  createSink: () => Sink;
  model?: TranscriptionModelId;
}) => {
  const [sink, setSink] = useState<Sink>();
  const [state, setState] = useState<TranscriptionState>({ phase: 'idle' });
  const [level, setLevel] = useState(0);
  const session = useRef<{
    transcriber: ReturnType<typeof createMicrophoneTranscriber>;
    phase: TranscriptionState['phase'];
  }>(undefined);

  useEffect(() => {
    const sink = createSink();
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
          if (mounted) setLevel(next);
        },
        onFinal: sink.ingestSegment,
        onProvisional: sink.updateProvisional,
        onStop: sink.flush,
      }),
    };
    session.current = current;
    setSink(sink);
    setState({ phase: 'idle' });
    setLevel(0);
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
          sink.close();
        }
      })();
    };
  }, [createSink, model]);

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
    /** Undefined until the first effect has created the session. */
    sink,
    state,
    /** Approximate microphone activity in [0, 1]. */
    level,
    listening: state.phase === 'running',
    /** True while loading, starting, or stopping; disable the toggle meanwhile. */
    busy: ['loading', 'starting', 'stopping'].includes(state.phase),
    toggle,
  };
};
