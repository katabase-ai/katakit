import { useEffect, useState, type ComponentProps } from 'react';
import {
  useMicrophoneLevel,
  useMicrophoneTranscriber,
  useMicrophoneTranscriberCallbacks,
} from '@katakit/transcription/react';
import { createListExtractionDemo } from './createListExtractionDemo';
import { ListExtractionDemo } from './ListExtractionDemo';
import { CaptureControls } from './ui/CaptureControls';
import { StandaloneDemo } from './ui/StandaloneDemo';

/** Standalone input ownership; gallery embeds supply their own shared capture controls. */
export const App = ({ connect }: Pick<ComponentProps<typeof ListExtractionDemo>, 'connect'>) => {
  const microphone = useMicrophoneTranscriber();
  const level = useMicrophoneLevel(microphone);
  const [runtime, setRuntime] = useState<ReturnType<typeof createListExtractionDemo>>();

  useEffect(() => {
    const demo = createListExtractionDemo();
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

  if (!runtime) return <p role="status">Preparing dictation…</p>;
  return (
    <StandaloneDemo
      title="List extraction"
      description="Tell it what to keep. Speak freely and collect selective lists."
      controls={
        <CaptureControls
          input={microphone.state}
          active={microphone.listening}
          level={level}
          busy={microphone.busy}
          onToggle={() => void microphone.toggle()}
        />
      }
    >
      <ListExtractionDemo
        runtime={runtime}
        connect={connect}
        listening={microphone.listening}
        captureBusy={microphone.busy}
        showIntroduction={false}
      />
    </StandaloneDemo>
  );
};
