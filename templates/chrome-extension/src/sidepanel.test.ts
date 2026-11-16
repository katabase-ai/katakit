import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('./kit', () => ({
  createTranscriptSession: () => ({
    conversationTurns$: { get: () => [], subscribe: () => ({ unsubscribe: () => {} }) },
    currentTurn$: { get: () => null, subscribe: () => ({ unsubscribe: () => {} }) },
    onFinal: vi.fn(),
    onStop: vi.fn(),
    clear: vi.fn(),
    close: vi.fn(),
  }),
}));

let receive: (message: object) => void;
let button: { disabled: boolean; textContent: string; onclick?: () => Promise<void> };
let micSetup: { onclick?: () => void };
let createTab: ReturnType<typeof vi.fn>;
let sendMessage: ReturnType<typeof vi.fn>;
let savedCapture: object | undefined;
let requestMic: ReturnType<typeof vi.fn>;
let releaseMic: ReturnType<typeof vi.fn>;
let fields: Record<string, { textContent: string }>;

beforeEach(async () => {
  vi.resetModules();
  savedCapture = undefined;
  button = { disabled: false, textContent: 'Start recording' };
  micSetup = {};
  createTab = vi.fn(async () => ({}));
  const clear = { disabled: true };
  const list = { replaceChildren: vi.fn() };
  fields = Object.fromEntries(
    ['#status', '#mic-permission', '#input-levels', '#pcm', '#recognition'].map(id => [
      id,
      { textContent: '' },
    ])
  );
  vi.stubGlobal('document', {
    querySelector: (selector: string) =>
      selector in fields
        ? fields[selector]
        : { '#toggle': button, '#mic-setup': micSetup, '#clear': clear, '#turns': list }[selector],
  });
  vi.stubGlobal('window', { addEventListener: vi.fn() });
  releaseMic = vi.fn();
  requestMic = vi.fn(async () => ({ getTracks: () => [{ stop: releaseMic }] }));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: requestMic } });
  sendMessage = vi.fn(async (message: { type: string }) => {
    if (message.type === 'START_CAPTURE')
      receive({ type: 'CAPTURE_STATUS', phase: 'recording', micConnected: true });
    if (message.type === 'STOP_CAPTURE') receive({ type: 'CAPTURE_STATUS', phase: 'idle' });
    return { ok: true };
  });
  vi.stubGlobal('chrome', {
    tabs: { create: createTab },
    storage: {
      session: { get: vi.fn(async () => ({ capture: savedCapture })), set: vi.fn(async () => {}) },
    },
    runtime: {
      getURL: (path: string) => `chrome-extension://starter/${path}`,
      sendMessage,
      onMessage: { addListener: (listener: typeof receive) => (receive = listener) },
    },
  });
  await import('./sidepanel');
  await Promise.resolve();
  await vi.waitFor(() => {
    if (!button.onclick || button.disabled) throw new Error('Panel is not ready');
  });
});

test('a duplicate Start restores the running state so Stop remains available', async () => {
  savedCapture = { phase: 'recording', micConnected: false };
  sendMessage.mockResolvedValueOnce({
    ok: false,
    error: 'Capture is already running. Stop it first.',
  });
  await button.onclick?.();
  expect(button.textContent).toBe('Stop recording');
  expect(fields['#mic-permission'].textContent).toBe('Microphone request: granted');
  await button.onclick?.();
  expect(sendMessage.mock.calls.map(([message]) => message.type)).toEqual([
    'START_CAPTURE',
    'STOP_CAPTURE',
  ]);
});

test('status before Start acknowledgement leaves the next click as Stop', async () => {
  await button.onclick?.();
  expect(requestMic).toHaveBeenCalledWith({ audio: true });
  expect(releaseMic).toHaveBeenCalledOnce();
  expect(requestMic.mock.invocationCallOrder[0]).toBeLessThan(
    sendMessage.mock.invocationCallOrder[0]
  );
  expect(button.textContent).toBe('Stop recording');
  expect(fields['#status'].textContent).toBe('Transcribing tab and mic');
  await button.onclick?.();
  expect(sendMessage.mock.calls.map(([message]) => message.type)).toEqual([
    'START_CAPTURE',
    'STOP_CAPTURE',
  ]);
  expect(button.textContent).toBe('Start recording');
});

test('denied microphone still starts tab-only capture', async () => {
  requestMic.mockRejectedValueOnce(new Error('Permission denied'));
  await button.onclick?.();
  expect(sendMessage.mock.calls[0]?.[0]).toEqual({ type: 'START_CAPTURE' });
  expect(button.textContent).toBe('Stop recording');
  expect(fields['#mic-permission'].textContent).toContain('Error');
  micSetup.onclick?.();
  expect(createTab).toHaveBeenCalledWith({
    url: 'chrome-extension://starter/mic-permission.html',
  });
});

test('reports source levels, delivered PCM and recognizer output without transcript text', () => {
  receive({
    type: 'CAPTURE_DIAGNOSTICS',
    tab: 0.08,
    mic: 0,
    capturedSeconds: 12,
    forwardedSeconds: 7.5,
    ready: true,
    provisional: 4,
    final: 0,
  });
  expect(fields['#input-levels'].textContent).toContain('tab 8.0% RMS, mic 0.0% RMS');
  expect(fields['#pcm'].textContent).toContain('12.0s captured, 7.5s sent');
  expect(fields['#recognition'].textContent).toContain('4 provisional updates, 0 finalized lines');
});
