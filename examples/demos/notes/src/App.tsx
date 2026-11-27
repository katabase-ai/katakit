import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { useMicrophoneTranscriber } from '@katakit/transcription/react';
import { createNotesDemo } from './createNotesDemo';
import { NotesDemo } from './NotesDemo';

/** Standalone capture stays here; the gallery supplies its own shared input owner. */
export const App = ({ connect }: Pick<ComponentProps<typeof NotesDemo>, 'connect'>) => {
  const [runtime, setRuntime] = useState<ReturnType<typeof createNotesDemo>>();
  const owner = useRef<ReturnType<typeof createNotesDemo>>(undefined);

  useEffect(() => {
    const demo = createNotesDemo();
    owner.current = demo;
    setRuntime(demo);
    return () => {
      owner.current = undefined;
      // The microphone holds its sink through stop/drain and closes it afterward.
    };
  }, []);
  const createSink = useCallback(() => {
    if (!owner.current) throw new Error('Notes runtime is not ready.');
    return owner.current;
  }, []);
  const microphone = useMicrophoneTranscriber({ createSink });

  if (!runtime) return <p role="status">Preparing demo…</p>;
  return (
    <NotesDemo
      runtime={runtime}
      connect={connect}
      listening={microphone.listening}
      controls={
        <div className="structured-notes-controls">
          <button type="button" onClick={() => void microphone.toggle()} disabled={microphone.busy}>
            {microphone.listening ? 'Stop listening' : 'Start listening'}
          </button>
          <span role="status">{microphone.state.error?.message ?? microphone.state.phase}</span>
        </div>
      }
    />
  );
};
