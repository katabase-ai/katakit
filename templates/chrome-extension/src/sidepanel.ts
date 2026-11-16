import { createTranscriptSession } from './kit';

const session = createTranscriptSession();
const list = document.querySelector<HTMLOListElement>('#turns')!;
const clear = document.querySelector<HTMLButtonElement>('#clear')!;
const button = document.querySelector<HTMLButtonElement>('#toggle')!;
const status = document.querySelector<HTMLElement>('#status')!;
let recording = false;
let restored = false;
type CaptureMessage = {
  type: string;
  segment?: Parameters<typeof session.onFinal>[0];
  phase?: string;
  error?: string;
  progress?: number;
  micConnected?: boolean;
};
const queued: CaptureMessage[] = [];

const render = () => {
  const turns = session.conversationTurns$.get();
  const current = session.currentTurn$.get();
  list.replaceChildren(
    ...[...turns, ...(current ? [current] : [])].map(turn => {
      const item = document.createElement('li');
      item.textContent = turn.text;
      return item;
    })
  );
  clear.disabled = turns.length === 0 && !current;
};
const completed = session.conversationTurns$.subscribe(render);
const active = session.currentTurn$.subscribe(render);

clear.onclick = async () => {
  clear.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: 'CLEAR_TRANSCRIPT' });
    if (!result?.ok) throw new Error(result?.error || 'Could not clear transcript.');
    session.clear();
  } catch (error) {
    show(error instanceof Error ? error.message : String(error));
  } finally {
    render();
  }
};
window.addEventListener('pagehide', () => {
  completed.unsubscribe();
  active.unsubscribe();
  session.close();
});

const show = (text: string) => {
  status.textContent = text;
  button.textContent = recording ? 'Stop recording' : 'Start recording';
};
const receive = (message: CaptureMessage) => {
  if (message.type === 'TRANSCRIPT_SEGMENT' && message.segment) session.onFinal(message.segment);
  if (message.type === 'TRANSCRIPT_STOP') session.onStop();
  if (message.type === 'CAPTURE_STATUS') {
    recording = message.phase === 'recording';
    button.disabled = message.phase === 'loading' || message.phase === 'stopping';
    show(
      message.phase === 'error'
        ? message.error || 'Recognition failed'
        : message.phase === 'loading'
          ? `Loading speech model${message.progress === undefined ? '…' : ` ${Math.round(message.progress * 100)}%`}`
          : recording
            ? `Transcribing ${message.micConnected ? 'tab and mic' : 'tab audio'}`
            : 'Recording is off'
    );
  }
};
chrome.runtime.onMessage.addListener(message => {
  if (!restored) queued.push(message);
  else receive(message);
});
void (async () => {
  try {
    const saved = await chrome.storage.session.get(['capture', 'segments']);
    const capture = saved.capture as { phase?: string; error?: string } | undefined;
    const segments = (saved.segments ?? []) as Parameters<typeof session.onFinal>[0][];
    for (const segment of segments) session.onFinal(segment);
    session.onStop();
    if (capture) receive({ type: 'CAPTURE_STATUS', ...capture });
  } catch (error) {
    show(`Could not restore transcript: ${String(error)}`);
  } finally {
    restored = true;
    for (const message of queued) receive(message);
    queued.length = 0;
  }
})();
button.onclick = async () => {
  button.disabled = true;
  show(recording ? 'Stopping recording…' : 'Loading speech model…');
  try {
    const result = await chrome.runtime.sendMessage({
      type: recording ? 'STOP_CAPTURE' : 'START_CAPTURE',
    });
    if (!result?.ok) throw new Error(result?.error || 'Capture failed');
    recording = !recording;
    show(recording ? 'Transcribing tab audio' : 'Recording is off');
  } catch (error) {
    show(error instanceof Error ? error.message : String(error));
  } finally {
    button.disabled = false;
  }
};
