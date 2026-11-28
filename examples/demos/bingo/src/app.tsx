import { createRoot } from 'react-dom/client';
import './standalone.css';
import { KatakitDevTools } from '@katakit/react';
import {
  MicrophoneTranscriberContext,
  useMicrophoneLevel,
  useMicrophoneTranscriber,
} from '@katakit/transcription/react';
import { CaptureControls } from './ui/CaptureControls';
import { StandaloneDemo } from './ui/StandaloneDemo';
import { Bingo as BingoView } from './bingo/bingo';

/** The copied example owns its input and runtime without importing any gallery code. */
const BrowserBingoDemo = () => {
  const microphone = useMicrophoneTranscriber();

  const microphoneLevel = useMicrophoneLevel(microphone);

  return (
    <MicrophoneTranscriberContext value={microphone}>
      <StandaloneDemo
        title="Bingo"
        description="Say it in the conversation. See it on the card. Five in a row wins!"
        controls={
          <CaptureControls
            input={microphone.state}
            active={microphone.listening}
            level={microphoneLevel}
            busy={microphone.busy}
            onToggle={() => void microphone.toggle()}
          />
        }
      >
        <BingoView showIntroduction={false} />
      </StandaloneDemo>
    </MicrophoneTranscriberContext>
  );
};

const App = () => (
  <>
    <KatakitDevTools />
    <BrowserBingoDemo />
  </>
);

createRoot(document.getElementById('root')!).render(<App />);
