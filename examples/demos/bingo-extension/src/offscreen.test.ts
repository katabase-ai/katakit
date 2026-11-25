import { afterEach, describe, expect, it, vi } from 'vitest';
import { TranscriptionError, type Transcriber } from '@katakit/transcription';
import type { BrowserTranscriberOptions } from '@katakit/transcription/browser';

const mocks = vi.hoisted(() => ({ transcriber: vi.fn(), capture: vi.fn() }));
vi.mock('@katakit/transcription/browser', () => ({
  createBrowserTranscriber: mocks.transcriber,
  defaultTranscriptionAssetsBaseUrl: '/transcription-assets/',
}));
vi.mock('./capture', () => ({
  createCapture: mocks.capture,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const setup = async () => {
  vi.resetModules();
  let listener!: (
    message: object,
    sender: object,
    respond: (response: object) => void
  ) => boolean | undefined;
  let callbacks!: BrowserTranscriberOptions;
  const events: string[] = [];
  const transcriber: Transcriber = {
    load: vi.fn(async () => {}),
    start: vi.fn(async () => {
      events.push('model start');
    }),
    write: vi.fn(() => {
      events.push('pcm');
    }),
    stop: vi.fn(async () => {
      events.push('model stop');
      callbacks.onFinal({ sourceId: 'session', id: '1', text: 'Final.' });
    }),
    dispose: vi.fn(async () => {
      events.push('dispose');
    }),
  };
  let onSamples!: (samples: Float32Array) => void;
  const capture = {
    start: vi.fn(async () => ({ micConnected: true })),
    stop: vi.fn(async () => {
      events.push('capture stop');
      onSamples(new Float32Array(32));
    }),
  };
  mocks.transcriber.mockImplementation(options => {
    callbacks = options;
    return transcriber;
  });
  mocks.capture.mockImplementation(callback => {
    onSamples = callback;
    return capture;
  });
  const sendMessage = vi.fn(async (message: { type: string; phase?: string }) => {
    if (message.type === 'TRANSCRIPT_SEGMENT') events.push('final');
    if (message.phase === 'idle') events.push('idle');
  });
  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: {
        addListener: (callback: typeof listener) => {
          listener = callback;
        },
      },
      sendMessage,
      getURL: (file: string) => `chrome-extension://example/${file}`,
    },
  });
  await import('./offscreen');
  const dispatch = (type: 'OFFSCREEN_START' | 'OFFSCREEN_STOP') =>
    new Promise<object>(resolve => {
      expect(listener({ type, streamId: 'tab-stream' }, {}, resolve)).toBe(true);
    });
  return {
    dispatch,
    capture,
    transcriber,
    sendMessage,
    events,
    get callbacks() {
      return callbacks;
    },
  };
};

describe('offscreen transcription host', () => {
  it('uses the utility PCM lifecycle and delivers capture buffers before draining results', async () => {
    const { dispatch, transcriber, capture, sendMessage, events } = await setup();
    expect(await dispatch('OFFSCREEN_START')).toEqual({ ok: true });
    expect(mocks.transcriber).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'moonshine-tiny',
        assetsBaseUrl: 'chrome-extension://example/transcription-assets/',
      })
    );
    expect(capture.start).toHaveBeenCalledWith('tab-stream');
    expect(await dispatch('OFFSCREEN_STOP')).toEqual({ ok: true });
    expect(events).toEqual([
      'model start',
      'capture stop',
      'pcm',
      'model stop',
      'final',
      'idle',
      'dispose',
    ]);
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'TRANSCRIPT_SEGMENT',
      segment: { sourceId: 'session', id: '1', text: 'Final.' },
    });
    expect(transcriber.dispose).toHaveBeenCalledOnce();
    expect(await dispatch('OFFSCREEN_START')).toEqual({ ok: true });
    expect(mocks.transcriber).toHaveBeenCalledTimes(2);
    await dispatch('OFFSCREEN_STOP');
  });

  it('releases capture and recognition resources after asynchronous model failure', async () => {
    const mock = await setup();
    await mock.dispatch('OFFSCREEN_START');
    mock.callbacks.onState?.({
      phase: 'error',
      error: new TranscriptionError('recognition-failed', 'worker failed'),
    });
    await vi.waitFor(() => expect(mock.transcriber.dispose).toHaveBeenCalledOnce());
    expect(mock.capture.stop).toHaveBeenCalledOnce();
    expect(mock.sendMessage).toHaveBeenCalledWith({
      type: 'CAPTURE_STATUS',
      phase: 'error',
      error: 'worker failed',
    });
    expect(mock.events).not.toContain('idle');
  });

  it('waits for in-progress capture startup before stopping its resources', async () => {
    const mock = await setup();
    let resolvePermission!: (result: { micConnected: boolean }) => void;
    const permission = new Promise<{ micConnected: boolean }>(resolve => {
      resolvePermission = resolve;
    });
    mock.capture.start.mockReturnValueOnce(permission);
    const start = mock.dispatch('OFFSCREEN_START');
    await vi.waitFor(() => expect(mock.capture.start).toHaveBeenCalledOnce());
    const stop = mock.dispatch('OFFSCREEN_STOP');
    expect(mock.capture.stop).not.toHaveBeenCalled();
    resolvePermission({ micConnected: false });
    expect(await start).toEqual({ ok: true });
    expect(await stop).toEqual({ ok: true });
    expect(mock.capture.stop).toHaveBeenCalledOnce();
  });

  it('retries a startup failure using a new utility owner', async () => {
    const mock = await setup();
    mock.transcriber.start = vi
      .fn()
      .mockRejectedValueOnce(new Error('download failed'))
      .mockResolvedValue(undefined);
    expect(await mock.dispatch('OFFSCREEN_START')).toEqual({ ok: false, error: 'download failed' });
    await vi.waitFor(() => expect(mock.transcriber.dispose).toHaveBeenCalledOnce());
    expect(await mock.dispatch('OFFSCREEN_START')).toEqual({ ok: true });
    expect(mocks.transcriber).toHaveBeenCalledTimes(2);
    await mock.dispatch('OFFSCREEN_STOP');
  });
});
