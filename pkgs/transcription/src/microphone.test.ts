import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMicrophoneTranscriber } from './microphone';
import type { TranscriptionState } from './types';
import type { EngineEvents, EngineSession, Transcriber } from './types';

const mocks = vi.hoisted(() => ({
  createEngine: vi.fn(),
  createCapture: vi.fn(),
}));
vi.mock('./browserTranscriber', () => ({ createBrowserRecognitionEngine: mocks.createEngine }));
vi.mock('./microphoneCapture', () => ({ createMicrophoneCapture: mocks.createCapture }));

const setup = (onLevel?: (level: number) => void) => {
  const events: string[] = [];
  let callbacks: EngineEvents;
  let onAudio: Transcriber['write'];
  const model: EngineSession = {
    start: vi.fn(async () => {
      events.push('model start');
    }),
    write: vi.fn(() => {
      events.push('last PCM');
    }),
    stop: vi.fn(async () => {
      events.push('model stop');
    }),
    close: vi.fn(() => {
      events.push('model dispose');
    }),
  };
  const capture = {
    start: vi.fn(async () => {
      events.push('capture start');
    }),
    stop: vi.fn(async () => {
      events.push('capture stop');
      onAudio(new Float32Array(1600).fill(0.5), 16_000);
    }),
  };
  const load = vi.fn(async (events: EngineEvents) => {
    callbacks = events;
    return model;
  });
  mocks.createEngine.mockReturnValue(load);
  mocks.createCapture.mockImplementation((_url, callback) => {
    onAudio = callback;
    return capture;
  });
  const states: TranscriptionState[] = [];
  const onFinal = vi.fn();
  const onProvisional = vi.fn();
  const input = createMicrophoneTranscriber({
    model: 'whisper-tiny',
    onFinal,
    onProvisional,
    onLevel,
    onStop: () => {
      events.push('flush');
    },
    onState: state => states.push(state),
  });
  return {
    input,
    model,
    load,
    capture,
    states,
    events,
    onFinal,
    onProvisional,
    get callbacks() {
      return callbacks;
    },
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('Worker', class {});
  vi.stubGlobal('AudioContext', class {});
  vi.stubGlobal('AudioWorkletNode', class {});
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('crossOriginIsolated', true);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } });
  vi.stubGlobal('location', new URL('https://example.test/app/'));
});
afterEach(() => vi.unstubAllGlobals());

describe('microphone host adapter', () => {
  it('reports microphone levels while forwarding PCM to shared recognition', async () => {
    const onLevel = vi.fn();
    const { input, model } = setup(onLevel);
    await input.start();
    const onAudio = mocks.createCapture.mock.calls[0]![1] as Transcriber['write'];
    const audio = new Float32Array(1600).fill(0.5);
    onAudio(audio, 16_000);
    expect(model.write).toHaveBeenCalledWith(audio, 16_000);
    expect(onLevel).toHaveBeenCalledWith(1);
    await input.dispose();
  });

  it('suppresses level callbacks from pending audio and capture flushing after disposal begins', async () => {
    const onLevel = vi.fn();
    const { input, model } = setup(onLevel);
    await input.start();
    const onAudio = mocks.createCapture.mock.calls[0]![1] as Transcriber['write'];
    const audio = new Float32Array(1600).fill(0.5);
    onAudio(audio, 16_000);
    expect(onLevel).toHaveBeenCalledWith(1);
    onLevel.mockClear();
    const disposal = input.dispose();
    onAudio(audio, 16_000);
    await disposal;
    expect(onLevel).not.toHaveBeenCalled();
    expect(model.stop).toHaveBeenCalledOnce();
    expect(model.close).toHaveBeenCalledOnce();
  });

  it('delivers the final capture buffer before draining recognition and flushing turns', async () => {
    const { input, events, states } = setup();
    await input.start();
    expect(states.at(-1)).toEqual({ phase: 'running' });
    await input.stop();
    expect(events).toEqual([
      'model start',
      'capture start',
      'capture stop',
      'last PCM',
      'model stop',
      'flush',
    ]);
    expect(states.at(-1)).toEqual({ phase: 'ready' });
    await input.dispose();
  });

  it('retries after microphone startup fails with an already loaded model', async () => {
    const { input, capture, model, states } = setup();
    capture.start.mockRejectedValueOnce(new DOMException('permission denied', 'NotAllowedError'));
    await expect(input.start()).rejects.toMatchObject({
      code: 'microphone-permission-denied',
      message: 'permission denied',
    });
    await vi.waitFor(() => expect(model.stop).toHaveBeenCalledOnce());
    expect(states.at(-1)).toMatchObject({
      phase: 'error',
      error: { message: 'permission denied' },
    });
    await input.start();
    expect(capture.start).toHaveBeenCalledTimes(2);
    expect(states.at(-1)).toEqual({ phase: 'running' });
    await input.dispose();
  });

  it('preloads without creating capture or requesting microphone permission', async () => {
    const { input, load, states } = setup();
    await input.load();
    expect(states.at(-1)).toEqual({ phase: 'ready' });
    expect(load).toHaveBeenCalledOnce();
    expect(mocks.createCapture).not.toHaveBeenCalled();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    await input.dispose();
  });

  it('rejects unavailable microphone APIs before loading a model', async () => {
    vi.stubGlobal('isSecureContext', false);
    const { input, load, states } = setup();
    await expect(input.start()).rejects.toMatchObject({ code: 'unsupported-environment' });
    expect(load).not.toHaveBeenCalled();
    expect(states.at(-1)).toMatchObject({
      phase: 'error',
      error: { code: 'unsupported-environment' },
    });
    await input.dispose();
  });

  it('starts a replacement recording only after pending capture cleanup completes', async () => {
    const { input, capture } = setup();
    await input.start();
    const stopped = Promise.withResolvers<void>();
    capture.stop.mockReturnValueOnce(stopped.promise);
    const stop = input.stop();
    const restart = input.start();
    expect(capture.start).toHaveBeenCalledOnce();
    stopped.resolve();
    await Promise.all([stop, restart]);
    expect(capture.start).toHaveBeenCalledTimes(2);
    await input.dispose();
    await expect(input.start()).rejects.toMatchObject({ code: 'disposed' });
  });

  it('waits for microphone startup before disposing and releases resources once', async () => {
    const mock = setup();
    const { input, capture, model, states, onFinal, onProvisional } = mock;
    const starting = Promise.withResolvers<void>();
    capture.start.mockReturnValueOnce(starting.promise);
    const start = input.start();
    await vi.waitFor(() => expect(capture.start).toHaveBeenCalledOnce());
    const disposal = input.dispose();
    const stateCalls = states.length;
    mock.callbacks.onFinal({ sourceId: 'late', id: '1', text: 'late' });
    mock.callbacks.onProvisional('late preview');
    starting.resolve();
    await Promise.all([start, disposal, input.dispose()]);
    expect(states).toHaveLength(stateCalls);
    expect(capture.stop).toHaveBeenCalledOnce();
    expect(model.close).toHaveBeenCalledOnce();
    expect(onFinal).not.toHaveBeenCalled();
    expect(onProvisional).not.toHaveBeenCalled();
  });
});
