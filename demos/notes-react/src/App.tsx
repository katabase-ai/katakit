import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { createMicrophoneTranscriber } from '@katakit/transcription/browser';
import type { TranscriptionState } from '@katakit/transcription';
import { createNotesDemo } from './createNotesDemo';
import { NotesDemo } from './NotesDemo';

/** Standalone capture stays here; the gallery supplies its own shared input owner. */
export const App = ({ connect }: Pick<ComponentProps<typeof NotesDemo>, 'connect'>) => {
  const [runtime, setRuntime] = useState<ReturnType<typeof createNotesDemo>>();
  const [input, setInput] = useState<TranscriptionState>({ phase: 'idle' });
  const source = useRef<ReturnType<typeof createMicrophoneTranscriber>>(undefined);
  useEffect(() => {
    const runtime = createNotesDemo();
    let mounted = true;
    const microphone = createMicrophoneTranscriber({
      onState: state => {
        if (mounted) setInput(state);
      },
      onFinal: runtime.ingestSegment,
      onProvisional: runtime.updateProvisional,
      onStop: runtime.flush,
    });
    source.current = microphone;
    setRuntime(runtime);
    return () => {
      mounted = false;
      source.current = undefined;
      runtime.notes.close();
      void (async () => {
        try {
          await microphone.dispose();
        } catch (error) {
          reportError(error);
        } finally {
          runtime.close();
        }
      })();
    };
  }, []);
  const toggle = async () => {
    try {
      await (input.phase === 'running' ? source.current?.stop() : source.current?.start());
    } catch {
      // onState reports permission/download failures beside the controls.
    }
  };
  if (!runtime) return <p role="status">Preparing demo…</p>;
  return (
    <NotesDemo
      runtime={runtime}
      listening={input.phase === 'running'}
      connect={connect}
      controls={
        <div className="structured-notes-controls">
          <button
            type="button"
            onClick={() => void toggle()}
            disabled={['loading', 'starting', 'stopping'].includes(input.phase)}
          >
            {input.phase === 'running' ? 'Stop listening' : 'Start listening'}
          </button>
          <span role="status">{input.error?.message ?? input.phase}</span>
        </div>
      }
    />
  );
};
