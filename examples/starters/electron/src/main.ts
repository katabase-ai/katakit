import { createMicrophoneTranscriber } from '@katakit/transcription/browser';
import { createTranscriptSession } from './kit';
import './style.css';

const session = createTranscriptSession();
const button = document.querySelector<HTMLButtonElement>('#record')!;
const status = document.querySelector<HTMLElement>('#status')!;
const empty = document.querySelector<HTMLElement>('#empty')!;
const notes = document.querySelector<HTMLOListElement>('#notes')!;
const preview = document.querySelector<HTMLElement>('#preview')!;
let running = false;

const render = () => {
  const turns = session.turns$.get();
  const current = session.pending$.get();
  notes.replaceChildren(
    ...[...turns, ...(current ? [current] : [])].map(turn => {
      const item = document.createElement('li');
      item.textContent = turn.text;
      return item;
    })
  );
  empty.hidden = notes.childElementCount > 0;
  preview.textContent = session.provisional$.get()?.text ?? '';
};
const subscriptions = [
  session.turns$.subscribe(render),
  session.pending$.subscribe(render),
  session.provisional$.subscribe(render),
];
const speech = createMicrophoneTranscriber({
  model: 'moonshine-tiny',
  onProvisional: session.onProvisional,
  onFinal: session.onFinal,
  onStop: session.onStop,
  onState: state => {
    running = state.phase === 'running';
    button.textContent = running ? 'Stop recording' : 'Record microphone';
    button.disabled = ['loading', 'starting', 'stopping'].includes(state.phase);
    status.textContent =
      state.error?.message ??
      (state.phase === 'loading'
        ? `Downloading model${state.progress === undefined ? '…' : ` ${Math.round(state.progress * 100)}%`}`
        : `Recognition: ${state.phase}`);
  },
});

button.addEventListener('click', () => {
  void (async () => {
    try {
      if (running) await speech.stop();
      else await speech.start();
    } catch {
      // Recognition and permission failures are shown via onState.
    }
  })();
});
window.addEventListener('pagehide', async () => {
  for (const subscription of subscriptions) subscription.unsubscribe();
  try {
    await speech.dispose();
  } finally {
    session.close();
  }
});
