import { createTranscriptSession } from './kit';

const session = createTranscriptSession();
const list = document.querySelector<HTMLOListElement>('#turns')!;
const clear = document.querySelector<HTMLButtonElement>('#clear')!;
const button = document.querySelector<HTMLButtonElement>('#toggle')!;
const status = document.querySelector<HTMLElement>('#status')!;
const micPermission = document.querySelector<HTMLElement>('#mic-permission')!;
const micSetup = document.querySelector<HTMLButtonElement>('#mic-setup')!;
const inputLevels = document.querySelector<HTMLElement>('#input-levels')!;
const pcm = document.querySelector<HTMLElement>('#pcm')!;
const recognition = document.querySelector<HTMLElement>('#recognition')!;
let recording = false;
let micConnected = false;
let restored = false;
type CaptureMessage = {
  type: string;
  segment?: Parameters<typeof session.onFinal>[0];
  phase?: string;
  error?: string;
  progress?: number;
  micConnected?: boolean;
  tab?: number;
  mic?: number;
  capturedSeconds?: number;
  forwardedSeconds?: number;
  provisional?: number;
  final?: number;
  ready?: boolean;
};
const queued: CaptureMessage[] = [];

const showMicPermission = (text: string) => {
  micPermission.textContent = text;
  micSetup.hidden = text === 'Microphone: enabled';
};

micSetup.onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = new URL(chrome.runtime.getURL('mic-permission.html'));
  if (tab?.id) url.searchParams.set('return', String(tab.id));
  await chrome.tabs.create({ url: url.href });
};

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
const showDiagnostics = (message: CaptureMessage) => {
  const level = (value: number | undefined) =>
    value === undefined ? 'unavailable' : `${(value * 100).toFixed(1)}% RMS`;
  inputLevels.textContent = `Peak input levels: tab ${level(message.tab)}, mic ${level(message.mic)}`;
  pcm.textContent = `PCM: ${message.capturedSeconds?.toFixed(1) ?? '0.0'}s captured, ${message.forwardedSeconds?.toFixed(1) ?? '0.0'}s sent to recognizer`;
  recognition.textContent = `Recognizer: ${message.ready ? 'ready' : 'loading'}, ${message.provisional ?? 0} provisional updates, ${message.final ?? 0} finalized lines`;
};
const receive = (message: CaptureMessage) => {
  if (message.type === 'MIC_PERMISSION_GRANTED') showMicPermission('Microphone: enabled');
  if (message.type === 'TRANSCRIPT_SEGMENT' && message.segment) session.onFinal(message.segment);
  if (message.type === 'TRANSCRIPT_STOP') session.onStop();
  if (message.type === 'CAPTURE_DIAGNOSTICS') showDiagnostics(message);
  if (message.type === 'CAPTURE_STATUS') {
    recording = message.phase === 'recording';
    micConnected = recording && !!message.micConnected;
    button.disabled = message.phase === 'loading' || message.phase === 'stopping';
    show(
      message.phase === 'error'
        ? message.error || 'Recognition failed'
        : message.phase === 'loading'
          ? `Loading speech model${message.progress === undefined ? '…' : ` ${Math.round(message.progress * 100)}%`}`
          : recording
            ? `Transcribing ${micConnected ? 'tab and mic' : 'tab audio'}`
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
    const saved = await chrome.storage.session.get([
      'capture',
      'segments',
      'diagnostics',
      'micPermission',
    ]);
    const capture = saved.capture as { phase?: string; error?: string } | undefined;
    const segments = (saved.segments ?? []) as Parameters<typeof session.onFinal>[0][];
    for (const segment of segments) session.onFinal(segment);
    session.onStop();
    if (typeof saved.micPermission === 'string') showMicPermission(saved.micPermission);
    if (saved.diagnostics) receive({ type: 'CAPTURE_DIAGNOSTICS', ...saved.diagnostics });
    if (capture) receive({ type: 'CAPTURE_STATUS', ...capture });
    try {
      const permission = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      if (permission.state === 'granted') showMicPermission('Microphone: enabled');
    } catch {
      // Permission queries are advisory; Start still checks the actual mic request.
    }
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
  show(recording ? 'Stopping recording…' : 'Starting capture…');
  try {
    const action = recording ? 'STOP_CAPTURE' : 'START_CAPTURE';
    if (action === 'START_CAPTURE') {
      inputLevels.textContent = 'Input levels: waiting for capture';
      pcm.textContent = 'PCM: waiting for capture';
      recognition.textContent = 'Recognizer: waiting for capture';
      showMicPermission('Microphone: checking…');
      try {
        // Chrome's hidden offscreen page cannot show the first mic permission
        // prompt. Grant it in this visible extension page, then release this
        // temporary stream; the offscreen page opens its own stream afterward.
        const permission = await navigator.mediaDevices.getUserMedia({ audio: true });
        permission.getTracks().forEach(track => track.stop());
        showMicPermission('Microphone: enabled');
      } catch (error) {
        // Microphone is optional: tab-only recording must still work.
        showMicPermission(
          `Microphone: unavailable (${error instanceof Error ? error.name : 'unknown error'}). Use Enable microphone above to grant access.`
        );
      }
      try {
        await chrome.storage.session.set({ micPermission: micPermission.textContent });
      } catch {
        // The panel still shows the permission result when session storage is unavailable.
      }
    }
    const result = await chrome.runtime.sendMessage({ type: action });
    if (!result?.ok) throw new Error(result?.error || 'Capture failed');
    // CAPTURE_STATUS may have set recording before the response arrives.
    // Inverting it here would turn a successful Start into another Start.
    recording = action === 'START_CAPTURE';
    show(
      recording ? `Transcribing ${micConnected ? 'tab and mic' : 'tab audio'}` : 'Recording is off'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Capture is already running')) {
      try {
        const { capture } = await chrome.storage.session.get('capture');
        const state = capture as { phase?: string; micConnected?: boolean } | undefined;
        if (state?.phase === 'recording') {
          receive({ type: 'CAPTURE_STATUS', ...state });
          return;
        }
      } catch {
        // Still report the original capture failure if session storage fails.
      }
    }
    show(message);
  } finally {
    button.disabled = false;
  }
};
