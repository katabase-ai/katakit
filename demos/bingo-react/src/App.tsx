import { useEffect, useState } from 'react';
import { createMicrophoneTranscriber } from '@katakit/transcription/browser';
import type { TranscriptionState } from '@katakit/transcription';
import { Button } from './controls';
import { AudioLevelMeter } from './AudioLevelMeter';
import { createBrowserBingoDemo } from './createBrowserBingoDemo';
import { BrowserBingoDemo as BingoView } from './BrowserBingoDemo';

/** The copied example owns its input and runtime without importing any gallery code. */
export const BrowserBingoDemo = () => {
  const [session, setSession] = useState<{
    runtime: ReturnType<typeof createBrowserBingoDemo>;
    input: ReturnType<typeof createMicrophoneTranscriber>;
  }>();
  const [state, setState] = useState<TranscriptionState>({ phase: 'idle' });
  const [level, setLevel] = useState(0);
  useEffect(() => {
    const runtime = createBrowserBingoDemo();
    let phase: TranscriptionState['phase'] = 'idle';
    let mounted = true;
    const input = createMicrophoneTranscriber({
      onState: state => {
        phase = state.phase;
        if (mounted) setState(state);
      },
      onLevel: level => {
        if (mounted) setLevel(level);
      },
      onFinal: runtime.ingestSegment,
      onProvisional: runtime.updateProvisional,
      onStop: runtime.flush,
    });
    setSession({ runtime, input });
    return () => {
      mounted = false;
      void (async () => {
        try {
          try {
            if (phase === 'running') await input.stop();
          } finally {
            try {
              await input.dispose();
            } finally {
              runtime.close();
            }
          }
        } catch (error) {
          reportError(error);
        }
      })();
    };
  }, []);
  if (!session) return <p role="status">Preparing bingo…</p>;
  const recording = state.phase === 'running';
  const toggle = async () => {
    try {
      await (recording ? session.input.stop() : session.input.start());
    } catch {
      /* The utility reports the failure through onState. */
    }
  };
  return (
    <BingoView
      runtime={session.runtime}
      controls={
        <>
          <p>English recognition runs on this device.</p>
          <Button
            disabled={['loading', 'starting', 'stopping'].includes(state.phase)}
            onClick={() => void toggle()}
          >
            {recording ? 'Stop listening' : 'Start listening'}
          </Button>
          <AudioLevelMeter active={recording} level={level} />
          <p role="status">{state.phase}</p>
          {state.error && <p role="alert">{state.error.message}</p>}
        </>
      }
    />
  );
};

export const App = () => (
  <main>
    <BrowserBingoDemo />
  </main>
);
