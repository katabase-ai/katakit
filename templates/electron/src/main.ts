import { emitEvent, events$ } from './kit';
import './style.css';

const form = document.querySelector<HTMLFormElement>('#note-form')!;
const input = document.querySelector<HTMLInputElement>('#note-input')!;
const status = document.querySelector<HTMLElement>('#status')!;
const empty = document.querySelector<HTMLElement>('#empty')!;
const notes = document.querySelector<HTMLOListElement>('#notes')!;

// The subscription is the UI connection; the method in kit.ts is the input connection.
const subscription = events$.subscribe(event => {
  const item = document.createElement('li');
  item.textContent = event.text;
  notes.append(item);
  empty.hidden = true;
  status.textContent = 'Note added to Katakit.';
});

form.addEventListener('submit', event => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) {
    status.textContent = 'Enter a note before adding it.';
    input.focus();
    return;
  }
  try {
    emitEvent({ type: 'note', text });
    input.value = '';
    input.focus();
  } catch {
    status.textContent = 'The note could not be added. Check the text and try again.';
  }
});

// The event log is in memory. Release the observer when the renderer closes.
window.addEventListener('beforeunload', () => subscription.unsubscribe(), { once: true });
