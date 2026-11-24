import { KatakitDevTools } from '@katakit/react';
import { useMicrophoneTranscriber } from '@katakit/transcription/react';
import { Button } from './controls';
import { AudioLevelMeter } from './AudioLevelMeter';
import { createBrowserBingoDemo } from './createBrowserBingoDemo';
import { BrowserBingoDemo as BingoView } from './BrowserBingoDemo';

/** The copied example owns its input and runtime without importing any gallery code. */
export const BrowserBingoDemo = () => {
  const microphone = useMicrophoneTranscriber({ createSink: createBrowserBingoDemo });
  if (!microphone.sink) return <p role="status">Preparing bingo…</p>;
  return (
    <BingoView
      runtime={microphone.sink}
      controls={
        <>
          <p>English recognition runs on this device.</p>
          <Button disabled={microphone.busy} onClick={() => void microphone.toggle()}>
            {microphone.listening ? 'Stop listening' : 'Start listening'}
          </Button>
          <AudioLevelMeter active={microphone.listening} level={microphone.level} />
          <p role="status">{microphone.state.phase}</p>
          {microphone.state.error && <p role="alert">{microphone.state.error.message}</p>}
        </>
      }
    />
  );
};

export const App = () => (
  <main>
    {import.meta.env.DEV && <KatakitDevTools />}
    <BrowserBingoDemo />
  </main>
);
