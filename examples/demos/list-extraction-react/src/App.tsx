import type { ComponentProps } from 'react';
import { useMicrophoneTranscriber } from '@katakit/transcription/react';
import { createListExtractionDemo } from './createListExtractionDemo';
import { ListExtractionDemo } from './ListExtractionDemo';

/** Standalone input ownership; gallery embeds supply their own shared capture controls. */
export const App = ({ connect }: Pick<ComponentProps<typeof ListExtractionDemo>, 'connect'>) => {
  const microphone = useMicrophoneTranscriber({ createSink: createListExtractionDemo });
  if (!microphone.sink) return <p role="status">Preparing dictation…</p>;
  return (
    <ListExtractionDemo
      runtime={microphone.sink}
      connect={connect}
      listening={microphone.listening}
      captureBusy={microphone.busy}
      controls={
        <div className="extraction-actions">
          <button type="button" onClick={() => void microphone.toggle()} disabled={microphone.busy}>
            {microphone.listening ? 'Stop listening' : 'Start listening'}
          </button>
          <span role="status">
            {microphone.state.error?.message ??
              (microphone.listening ? 'Listening locally' : 'Microphone off')}
          </span>
        </div>
      }
    />
  );
};
