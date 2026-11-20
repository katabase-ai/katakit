import { useCallback, type ComponentProps } from 'react';
import { useMicrophoneTranscriber } from '@katakit/transcription/react';
import { BrainstormDemo } from './BrainstormDemo';
import { createBrainstormDemo } from './createBrainstormDemo';
import { Button } from './controls';

/** Standalone capture is owned here; the gallery provides its single shared microphone. */
export const App = ({ connect }: Pick<ComponentProps<typeof BrainstormDemo>, 'connect'>) => {
  const microphone = useMicrophoneTranscriber({ createSink: createBrainstormDemo });
  const stopListening = useCallback(async () => {
    if (microphone.listening) await microphone.toggle();
  }, [microphone.listening, microphone.toggle]);
  if (!microphone.sink) return <p role="status">Preparing game…</p>;
  return (
    <BrainstormDemo
      runtime={microphone.sink}
      listening={microphone.listening}
      stopListening={stopListening}
      connect={connect}
      controls={
        <div className="brainstorm-standalone-controls">
          <Button disabled={microphone.busy} onClick={() => void microphone.toggle()}>
            {microphone.listening ? 'Stop listening' : 'Start listening'}
          </Button>
          <span role="status">
            {microphone.state.error?.message ??
              (microphone.busy
                ? 'Preparing microphone…'
                : microphone.listening
                  ? 'Listening locally'
                  : 'Microphone off')}
          </span>
        </div>
      }
    />
  );
};
