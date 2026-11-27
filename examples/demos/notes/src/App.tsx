import { useEffect, useState, type ComponentProps } from 'react';
import {
  useMicrophoneTranscriber,
  useMicrophoneTranscriberCallbacks,
} from '@katakit/transcription/react';
import { createNotesDemo } from './createNotesDemo';
import { NotesDemo } from './NotesDemo';

/** Standalone capture stays here; the gallery supplies its own shared input owner. */
export const App = ({ connect }: Pick<ComponentProps<typeof NotesDemo>, 'connect'>) => {
  const microphone = useMicrophoneTranscriber();
  const [runtime, setRuntime] = useState<ReturnType<typeof createNotesDemo>>();

  useEffect(() => {
    const demo = createNotesDemo();
    setRuntime(demo);
    return () => {
      demo.flush();
      demo.close();
    };
  }, []);

  useMicrophoneTranscriberCallbacks(microphone, {
    onUtterance: runtime?.ingestSegment,
    onProvisionalUtterance: runtime?.updateProvisional,
    onFlush: runtime?.flush,
  });

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
