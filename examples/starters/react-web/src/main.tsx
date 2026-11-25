import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createMicrophoneTranscriber } from '@katakit/transcription/browser';
import type { TranscriptionState } from '@katakit/transcription';
import { createTranscriptSession } from './katakit';
import './style.css';

const session = createTranscriptSession();
const speech = createMicrophoneTranscriber({
  model: 'moonshine-tiny',
  onProvisional: session.onProvisional,
  onFinal: session.onFinal,
  onStop: session.onStop,
  onState: state => window.dispatchEvent(new CustomEvent('speech-state', { detail: state })),
});

const App = () => {
  const [turns, setTurns] = useState(session.turns$.get());
  const [current, setCurrent] = useState(session.pending$.get());
  const [provisional, setProvisional] = useState(session.provisional$.get()?.text);
  const [state, setState] = useState<TranscriptionState>({ phase: 'idle' });

  useEffect(() => {
    const completed = session.turns$.subscribe(setTurns);
    const active = session.pending$.subscribe(setCurrent);
    const preview = session.provisional$.subscribe(value => setProvisional(value?.text));
    const onState = (event: Event) => setState((event as CustomEvent<TranscriptionState>).detail);
    window.addEventListener('speech-state', onState);
    return () => {
      completed.unsubscribe();
      active.unsubscribe();
      preview.unsubscribe();
      window.removeEventListener('speech-state', onState);
      void (async () => {
        try {
          await speech.dispose();
        } finally {
          session.close();
        }
      })();
    };
  }, []);

  const busy = ['loading', 'starting', 'stopping'].includes(state.phase);
  const supported = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
  const running = state.phase === 'running';
  const toggle = async () => {
    try {
      if (running) await speech.stop();
      else await speech.start();
    } catch {
      // The state callback supplies the actionable recognition/permission error.
    }
  };

  return (
    <main>
      <h1>Katakit microphone transcript</h1>
      <p>Record locally with Moonshine Tiny. Final speech becomes Katakit conversation turns.</p>
      <button type="button" onClick={() => void toggle()} disabled={busy || !supported}>
        {running ? 'Stop recording' : 'Start recording'}
      </button>
      <p role="status">
        {!supported
          ? 'Microphone capture needs localhost or HTTPS and a supported browser.'
          : state.phase === 'loading'
            ? `Downloading model${state.progress === undefined ? '…' : `: ${Math.round(state.progress * 100)}%`}`
            : (state.error?.message ?? `Recognition: ${state.phase}`)}
      </p>
      <h2>Conversation turns</h2>
      {turns.length === 0 && !current && <p>No speech recognized yet.</p>}
      <ul>
        {turns.map(turn => (
          <li key={turn.id}>{turn.text}</li>
        ))}
        {current && <li>{current.text}</li>}
      </ul>
      {provisional && <p>Listening: {provisional}</p>}
      <p className="note">
        First use downloads a model. Audio is processed in your browser; turns stay in memory and
        disappear on reload.
      </p>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
