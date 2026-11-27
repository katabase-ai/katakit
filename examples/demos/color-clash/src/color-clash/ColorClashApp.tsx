import { useCallback, useMemo, useState } from 'react';
import { useMicrophoneTranscriber } from '@katakit/transcription/react';
import { ColorClash } from './ColorClash';
import { createColorClash } from './createColorClash';

/** A fresh owner after cancellation disposes the previous model request and capture. */
const Game = ({ onCancel }: { onCancel: () => void }) => {
  const game = useMemo(() => createColorClash(), []);
  const createSink = useCallback(() => game, [game]);
  const microphone = useMicrophoneTranscriber({ createSink });
  return (
    <ColorClash
      runtime={game}
      input={microphone.state}
      disabled={microphone.busy}
      onPlay={async () => {
        await microphone.toggle();
        return true;
      }}
      onCancel={onCancel}
      onStop={() => void microphone.toggle()}
    />
  );
};

export const App = () => {
  const [session, setSession] = useState(0);
  return (
    <main>
      <h1>Color clash</h1>
      <p>Say the ink color, not the word. Speech stays on your device.</p>
      <Game key={session} onCancel={() => setSession(value => value + 1)} />
    </main>
  );
};
