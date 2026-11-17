import { App } from '@modelcontextprotocol/ext-apps';
import { createNotes } from './notes';
import './style.css';

const form = document.querySelector<HTMLFormElement>('#note-form')!;
const input = document.querySelector<HTMLInputElement>('#note-input')!;
const list = document.querySelector<HTMLOListElement>('#notes')!;
const status = document.querySelector<HTMLElement>('#status')!;
const notes = createNotes();

const subscription = notes.notes$.subscribe(values => {
  list.replaceChildren(
    ...values.map(value => {
      const item = document.createElement('li');
      item.textContent = value; // Never interpret user text as HTML.
      return item;
    })
  );
  status.textContent = values.length
    ? `${values.length} note${values.length === 1 ? '' : 's'} in this card`
    : 'Ready';
});

form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    notes.add(input.value);
    input.value = '';
    input.focus();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Could not add note';
  }
});

let closed = false;
const close = () => {
  if (closed) return;
  closed = true;
  subscription.unsubscribe();
  notes.close();
};
window.addEventListener('pagehide', close);

// The same card works as a standalone browser preview. In a chat host, connect
// to the MCP Apps bridge; neither path sends note text to the server.
if (!['127.0.0.1', 'localhost'].includes(location.hostname)) {
  const app = new App({ name: 'Katakit notes', version: '0.1.0' });
  app.onteardown = async () => {
    close();
    return {};
  };
  const connect = async () => {
    try {
      await app.connect();
    } catch (error) {
      status.textContent = `Host bridge unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
  };
  void connect();
}
