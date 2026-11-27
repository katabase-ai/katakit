import { createRoot } from 'react-dom/client';
import './ui/base.css';
import { KatakitDevTools } from '@katakit/react';
import {
  MicrophoneTranscriberContext,
  useMicrophoneLevel,
  useMicrophoneTranscriber,
} from '@katakit/transcription/react';
import { Button } from './ui/controls';
import { AudioLevelMeter } from './ui/AudioLevelMeter';
import { BrowserBingoDemo as BingoView } from './BrowserBingoDemo';

/** The copied example owns its input and runtime without importing any gallery code. */
const BrowserBingoDemo = () => {
  const microphone = useMicrophoneTranscriber();

  const microphoneLevel = useMicrophoneLevel(microphone);

  return (
    <MicrophoneTranscriberContext value={microphone}>
      <BingoView
        controls={
          <>
            <p>English recognition runs on this device.</p>
            <Button disabled={microphone.busy} onClick={() => void microphone.toggle()}>
              {microphone.listening ? 'Stop listening' : 'Start listening'}
            </Button>
            <AudioLevelMeter active={microphone.listening} level={microphoneLevel} />
            <p role="status">{microphone.state.phase}</p>
            {microphone.state.error && <p role="alert">{microphone.state.error.message}</p>}
          </>
        }
      />
    </MicrophoneTranscriberContext>
  );
};

const App = () => (
  <main>
    <KatakitDevTools />
    <BrowserBingoDemo />
  </main>
);

createRoot(document.getElementById('root')!).render(<App />);
