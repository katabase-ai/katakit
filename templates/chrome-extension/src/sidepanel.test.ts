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
let sendMessage: ReturnType<typeof vi.fn>;
let savedCapture: object | undefined;
let requestMic: ReturnType<typeof vi.fn>;
let releaseMic: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  savedCapture = undefined;
  button = { disabled: false, textContent: 'Start recording' };
  const clear = { disabled: true };
  const list = { replaceChildren: vi.fn() };
  const status = { textContent: 'Recording is off' };
  vi.stubGlobal('document', {
    querySelector: (selector: string) =>
      ({ '#toggle': button, '#clear': clear, '#turns': list, '#status': status })[selector],
  });
  vi.stubGlobal('window', { addEventListener: vi.fn() });
  releaseMic = vi.fn();
  requestMic = vi.fn(async () => ({ getTracks: () => [{ stop: releaseMic }] }));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: requestMic } });
  sendMessage = vi.fn(async (message: { type: string }) => {
    if (message.type === 'START_CAPTURE') receive({ type: 'CAPTURE_STATUS', phase: 'recording' });
    if (message.type === 'STOP_CAPTURE') receive({ type: 'CAPTURE_STATUS', phase: 'idle' });
    return { ok: true };
  });
  vi.stubGlobal('chrome', {
    storage: { session: { get: vi.fn(async () => ({ capture: savedCapture })) } },
    runtime: {
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
});
