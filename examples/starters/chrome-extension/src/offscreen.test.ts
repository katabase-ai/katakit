import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  startCapture: vi.fn(async () => ({ micConnected: false })),
  startModel: vi.fn(async () => {}),
  write: vi.fn(),
  samples: undefined as ((samples: Float32Array) => void) | undefined,
  levels: undefined as ((levels: { tab: number; mic?: number }) => void) | undefined,
  provisional: undefined as (() => void) | undefined,
  final: undefined as ((segment: object) => void) | undefined,
}));

vi.mock('./capture', () => ({
  createCapture: (
    onSamples: (samples: Float32Array) => void,
    onLevels: (levels: { tab: number; mic?: number }) => void
  ) => {
    mocks.samples = onSamples;
    mocks.levels = onLevels;
    return { start: mocks.startCapture, stop: vi.fn(async () => {}) };
  },
}));
vi.mock('@katakit/transcription/browser', () => ({
  defaultTranscriptionAssetsBaseUrl: '/transcription-assets/',
  createBrowserTranscriber: (options: {
    onProvisional: () => void;
    onFinal: (segment: object) => void;
  }) => {
    mocks.provisional = options.onProvisional;
    mocks.final = options.onFinal;
    return {
      start: mocks.startModel,
      stop: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
      write: mocks.write,
    };
  },
}));

let listener: (
  message: { type: string; streamId?: string },
  sender: object,
  respond: (value: object) => void
) => void;
let sendMessage: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  mocks.startCapture.mockClear();
  mocks.startModel.mockClear();
  mocks.write.mockClear();
  sendMessage = vi.fn(async () => ({}));
  vi.stubGlobal('chrome', {
    runtime: {
      getURL: (path: string) => `chrome-extension://starter/${path}`,
      sendMessage,
      onMessage: { addListener: (callback: typeof listener) => (listener = callback) },
    },
  });
  await import('./offscreen');
});

test('redeems the single-use tab stream before starting or downloading the model', async () => {
  const result = await new Promise(resolve =>
    listener({ type: 'OFFSCREEN_START', streamId: 'fresh-id' }, {}, resolve)
  );
  expect(result).toEqual({ ok: true });
  expect(mocks.startCapture).toHaveBeenCalledWith('fresh-id');
  expect(mocks.startCapture.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.startModel.mock.invocationCallOrder[0]
  );
});

test('reports signal, PCM forwarding and text-free recognition counts', async () => {
  await new Promise(resolve =>
    listener({ type: 'OFFSCREEN_START', streamId: 'fresh-id' }, {}, resolve)
  );
  mocks.samples?.(new Float32Array(16_000));
  mocks.levels?.({ tab: 0.12, mic: 0.03 });
  mocks.provisional?.();
  mocks.final?.({ id: 'line-1', text: 'private speech' });
  expect(mocks.write).toHaveBeenCalledWith(expect.any(Float32Array), 16_000);
  expect(sendMessage).toHaveBeenCalledWith({
    type: 'CAPTURE_DIAGNOSTICS',
    tab: 0.12,
    mic: 0.03,
    capturedSeconds: 1,
    forwardedSeconds: 1,
    ready: true,
    provisional: 1,
    final: 1,
  });
  const diagnosticMessages = sendMessage.mock.calls
    .map(([message]) => message)
    .filter(message => message.type === 'CAPTURE_DIAGNOSTICS');
  expect(JSON.stringify(diagnosticMessages)).not.toContain('private speech');
});

test('separates captured PCM from PCM forwarded while the model loads', async () => {
  let finishModel: (() => void) | undefined;
  mocks.startModel.mockImplementationOnce(
    () => new Promise<void>(resolve => (finishModel = resolve))
  );
  const started = new Promise(resolve =>
    listener({ type: 'OFFSCREEN_START', streamId: 'fresh-id' }, {}, resolve)
  );
  await vi.waitFor(() => expect(finishModel).toBeDefined());
  mocks.samples?.(new Float32Array(16_000));
  mocks.levels?.({ tab: 0.2 });
  expect(sendMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'CAPTURE_DIAGNOSTICS',
      capturedSeconds: 1,
      forwardedSeconds: 0,
      ready: false,
    })
  );
  finishModel?.();
  await started;
  mocks.samples?.(new Float32Array(16_000));
  expect(mocks.write).toHaveBeenCalledOnce();
  mocks.levels?.({ tab: 0.2 });
  expect(sendMessage).toHaveBeenCalledWith(
    expect.objectContaining({ capturedSeconds: 2, forwardedSeconds: 1, ready: true })
  );
});
