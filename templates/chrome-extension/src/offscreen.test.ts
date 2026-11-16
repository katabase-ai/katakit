import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  startCapture: vi.fn(async () => ({ micConnected: false })),
  startModel: vi.fn(async () => {}),
}));

vi.mock('./capture', () => ({
  createCapture: () => ({ start: mocks.startCapture, stop: vi.fn(async () => {}) }),
}));
vi.mock('@katakit/transcription/browser', () => ({
  defaultTranscriptionAssetsBaseUrl: '/transcription-assets/',
  createBrowserTranscriber: () => ({
    start: mocks.startModel,
    stop: vi.fn(async () => {}),
    dispose: vi.fn(async () => {}),
    write: vi.fn(),
  }),
}));

let listener: (
  message: { type: string; streamId?: string },
  sender: object,
  respond: (value: object) => void
) => void;

beforeEach(async () => {
  vi.resetModules();
  mocks.startCapture.mockClear();
  mocks.startModel.mockClear();
  vi.stubGlobal('chrome', {
    runtime: {
      getURL: (path: string) => `chrome-extension://starter/${path}`,
      sendMessage: vi.fn(async () => ({})),
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
