import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { createMicrophoneTranscriber } from '@katakit/transcription/browser';
import type { TranscriptionState } from '@katakit/transcription';
import { WordRushDemo } from './WordRushDemo';
import { createWordRushDemo } from './createWordRushDemo';

type Capture = {
  runtime: ReturnType<typeof createWordRushDemo>;
  helper?: ReturnType<typeof createMicrophoneTranscriber>;
  phase: TranscriptionState['phase'];
  disposal?: Promise<void>;
};

/** Standalone capture is owned here; the gallery provides its single shared microphone. */
export const App = ({ connect }: Pick<ComponentProps<typeof WordRushDemo>, 'connect'>) => {
  const [runtime, setRuntime] = useState<Capture['runtime']>();
  const [input, setInput] = useState<TranscriptionState>({ phase: 'idle' });
  const owner = useRef<Capture>(undefined);
  useEffect(() => {
    const current: Capture = { runtime: createWordRushDemo(), phase: 'idle' };
    owner.current = current;
    setRuntime(current.runtime);
    return () => {
      owner.current = undefined;
      void (async () => {
        try {
          await current.disposal;
          await current.helper?.dispose();
        } finally {
          current.runtime.close();
        }
      })();
    };
  }, []);
  const stopListening = useCallback(async () => {
    const current = owner.current;
    if (!current) return;
    await current.disposal;
    if (current.helper && ['loading', 'starting'].includes(current.phase)) {
      const helper = current.helper;
      current.helper = undefined;
      current.phase = 'idle';
      setInput({ phase: 'idle' });
      current.disposal = helper.dispose();
      await current.disposal;
    } else await current.helper?.stop();
  }, []);
  const startListening = useCallback(
    async (signal: AbortSignal) => {
      const current = owner.current;
      if (!current) return false;
      await current.disposal;
      signal.throwIfAborted();
      if (!current.helper) {
        const helper = createMicrophoneTranscriber({
          onState: state => {
            if (owner.current === current && current.helper === helper) {
              current.phase = state.phase;
              setInput(state);
            }
          },
          onFinal: segment => {
            if (current.helper === helper) current.runtime.ingestSegment(segment);
          },
          onProvisional: text => {
            if (current.helper === helper) current.runtime.updateProvisional(text);
          },
          onStop: () => {
            if (current.helper === helper) current.runtime.flush();
          },
        });
        current.helper = helper;
      }
      const cancel = async () => {
        try {
          await stopListening();
        } catch {
          /* The host presents capture failures. */
        }
      };
      signal.addEventListener('abort', cancel, { once: true });
      try {
        await current.helper.start();
        return !signal.aborted && current.phase === 'running';
      } finally {
        signal.removeEventListener('abort', cancel);
      }
    },
    [stopListening]
  );
  const isListening = useCallback(() => owner.current?.phase === 'running', []);
  if (!runtime) return <p role="status">Preparing game…</p>;
  return (
    <WordRushDemo
      runtime={runtime}
      listening={input.phase === 'running'}
      startListening={startListening}
      isListening={isListening}
      stopListening={stopListening}
      connect={connect}
      setupMessage={
        input.phase === 'loading'
          ? `Downloading speech model…${input.progress === undefined ? '' : ` ${Math.round(input.progress * 100)}%`}`
          : 'Allow microphone access in your browser.'
      }
      controls={input.error && <p role="alert">{input.error.message}</p>}
    />
  );
};
