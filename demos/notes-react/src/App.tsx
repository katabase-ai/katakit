import type { ComponentProps } from 'react';
import { useMicrophoneTranscriber } from '@katakit/transcription/react';
import { createNotesDemo } from './createNotesDemo';
import { NotesDemo } from './NotesDemo';

/** Standalone capture stays here; the gallery supplies its own shared input owner. */
export const App = ({ connect }: Pick<ComponentProps<typeof NotesDemo>, 'connect'>) => {
  const microphone = useMicrophoneTranscriber({ createSink: createNotesDemo });
  if (!microphone.sink) return <p role="status">Preparing demo…</p>;
  return (
    <NotesDemo
      runtime={microphone.sink}
      listening={microphone.listening}
      connect={connect}
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
