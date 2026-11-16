import { addText, clearText, closeKit, turns$ } from './kit';

const form = document.querySelector<HTMLFormElement>('#text-form')!;
const input = document.querySelector<HTMLInputElement>('#text')!;
const list = document.querySelector<HTMLOListElement>('#turns')!;
const textStatus = document.querySelector<HTMLElement>('#text-status')!;
const clear = document.querySelector<HTMLButtonElement>('#clear')!;

const subscription = turns$.subscribe(turns => {
  list.replaceChildren(
    ...turns.map(turn => {
      const item = document.createElement('li');
      item.textContent = turn;
      return item;
    })
  );
  clear.disabled = turns.length === 0;
  textStatus.textContent = turns.length
    ? `${turns.length} text turn(s) in Katakit.`
    : 'No text yet.';
});

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!input.value.trim()) {
    textStatus.textContent = 'Enter some text first.';
    return;
  }
  try {
    addText(input.value);
    input.value = '';
    input.focus();
  } catch (error) {
    textStatus.textContent = `Could not add text: ${String(error)}`;
  }
});
clear.addEventListener('click', () => {
  clearText();
  input.focus();
});
window.addEventListener('pagehide', () => {
  subscription.unsubscribe();
  closeKit();
});

const button = document.querySelector<HTMLButtonElement>('#toggle')!;
const status = document.querySelector<HTMLElement>('#status')!;
let recording = false;
const show = (text: string) => {
  status.textContent = text;
  button.textContent = recording ? 'Stop capture' : 'Start capture';
};
chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'CAPTURE_STATUS') {
    recording = message.phase === 'recording';
    show(
      message.phase === 'error'
        ? message.error || 'Capture failed'
        : recording
          ? `Capturing ${message.micConnected ? 'tab and mic' : 'tab only'} (not transcribed)`
          : 'Capture is off'
    );
  }
});
void (async () => {
  try {
    const { capture } = await chrome.storage.session.get('capture');
    const saved = capture as { phase?: string; micConnected?: boolean } | undefined;
    if (saved?.phase === 'recording') {
      recording = true;
      show(`Capturing ${saved.micConnected ? 'tab and mic' : 'tab only'} (not transcribed)`);
    }
  } catch (error) {
    show(`Could not read capture status: ${String(error)}`);
  }
})();
button.onclick = async () => {
  button.disabled = true;
  show(recording ? 'Stopping capture…' : 'Starting capture…');
  try {
    const result = await chrome.runtime.sendMessage({
      type: recording ? 'STOP_CAPTURE' : 'START_CAPTURE',
    });
    if (result?.ok) recording = !recording;
    show(
      result?.ok
        ? recording
          ? 'Capturing audio (not transcribed)'
          : 'Capture is off'
        : result?.error || 'Capture failed'
    );
  } catch (error) {
    show(`Capture failed: ${String(error)}`);
  } finally {
    button.disabled = false;
  }
};
