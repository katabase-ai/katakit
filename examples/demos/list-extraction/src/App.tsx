import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { useMicrophoneTranscriber } from '@katakit/transcription/react';
import { createListExtractionDemo } from './createListExtractionDemo';
import { ListExtractionDemo } from './ListExtractionDemo';

/** Standalone input ownership; gallery embeds supply their own shared capture controls. */
export const App = ({ connect }: Pick<ComponentProps<typeof ListExtractionDemo>, 'connect'>) => {
  const [runtime, setRuntime] = useState<ReturnType<typeof createListExtractionDemo>>();
  const owner = useRef<ReturnType<typeof createListExtractionDemo>>(undefined);

  useEffect(() => {
    const demo = createListExtractionDemo();
    owner.current = demo;
    setRuntime(demo);
    return () => {
      owner.current = undefined;
      // The microphone holds its sink through stop/drain and closes it afterward.
    };
  }, []);
  const createSink = useCallback(() => {
    if (!owner.current) throw new Error('List extraction runtime is not ready.');
    return owner.current;
  }, []);
  const microphone = useMicrophoneTranscriber({ createSink });

  if (!runtime) return <p role="status">Preparing dictation…</p>;
  return (
    <ListExtractionDemo
      runtime={runtime}
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
