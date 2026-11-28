import { useEffect, useState, type ComponentProps } from 'react';
import {
  useMicrophoneLevel,
  useMicrophoneTranscriber,
  useMicrophoneTranscriberCallbacks,
} from '@katakit/transcription/react';
import { createNotesDemo } from './createNotesDemo';
import { NotesDemo } from './NotesDemo';
import { CaptureControls } from './ui/CaptureControls';
import { StandaloneDemo } from './ui/StandaloneDemo';

/** Standalone capture stays here; the gallery supplies its own shared input owner. */
export const App = ({ connect }: Pick<ComponentProps<typeof NotesDemo>, 'connect'>) => {
  const microphone = useMicrophoneTranscriber();
  const level = useMicrophoneLevel(microphone);
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
    <StandaloneDemo
      title="Structured notes"
      description="Talk through a plan. Notes take shape as you finish each thought."
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
      <NotesDemo
        runtime={runtime}
        connect={connect}
        listening={microphone.listening}
        showIntroduction={false}
      />
    </StandaloneDemo>
  );
};
