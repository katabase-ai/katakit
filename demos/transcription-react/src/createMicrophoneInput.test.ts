import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMicrophoneInput, type InputState } from './createMicrophoneInput';
import type { TranscriptionCallbacks, TranscriptionModel } from '@katakit/transcription/models';

const mocks = vi.hoisted(() => ({
  createModel: vi.fn(),
  createCapture: vi.fn(),
}));
vi.mock('@katakit/transcription/models', () => ({ createTranscriptionModel: mocks.createModel }));
vi.mock('./createMicrophoneCapture', () => ({ createMicrophoneCapture: mocks.createCapture }));

const setup = (onLevel?: (level: number) => void) => {
  const events: string[] = [];
  let callbacks: TranscriptionCallbacks;
  const model: TranscriptionModel = {
    load: vi.fn(async () => {}),
    start: vi.fn(async () => {
      events.push('model start');
    }),
    write: vi.fn(() => {
      events.push('last PCM');
    }),
    stop: vi.fn(async () => {
      events.push('model stop');
      callbacks.onStop?.();
    }),
    dispose: vi.fn(async () => {
      events.push('model dispose');
    }),
  };
  const capture = {
    start: vi.fn(async () => {
      events.push('capture start');
    }),
    stop: vi.fn(async () => {
      events.push('capture stop');
      model.write(new Float32Array(1), 16_000);
    }),
  };
  mocks.createModel.mockImplementation((options: TranscriptionCallbacks) => {
    callbacks = options;
    return model;
  });
  mocks.createCapture.mockReturnValue(capture);
  const states: InputState[] = [];
  const onFinal = vi.fn();
  const onProvisional = vi.fn();
  const input = createMicrophoneInput({
    model: { provider: 'whisper', createWorker: vi.fn() },
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

beforeEach(() => vi.clearAllMocks());

describe('microphone host adapter', () => {
  it('reports microphone levels while forwarding PCM to shared recognition', async () => {
    const onLevel = vi.fn();
    const { input, model } = setup(onLevel);
    await input.start();
    const onAudio = mocks.createCapture.mock.calls[0]![0] as TranscriptionModel['write'];
    const audio = new Float32Array(1600).fill(0.5);
    onAudio(audio, 16_000);
    expect(model.write).toHaveBeenCalledWith(audio, 16_000);
    expect(onLevel).toHaveBeenCalledWith(1);
    await input.dispose();
  });

  it('delivers the final capture buffer before draining recognition and flushing turns', async () => {
    const { input, events, states } = setup();
    await input.start();
    expect(states.at(-1)).toEqual({ phase: 'recording' });
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
    capture.start.mockRejectedValueOnce(new Error('permission denied'));
    await input.start();
    await vi.waitFor(() => expect(model.stop).toHaveBeenCalledOnce());
    expect(states.at(-1)).toEqual({ phase: 'error', error: 'permission denied' });
    await input.start();
    expect(capture.start).toHaveBeenCalledTimes(2);
    expect(states.at(-1)).toEqual({ phase: 'recording' });
    await input.dispose();
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
    mock.callbacks.onProvisional?.('late preview');
    starting.resolve();
    await Promise.all([start, disposal, input.dispose()]);
    expect(states).toHaveLength(stateCalls);
    expect(capture.stop).toHaveBeenCalledOnce();
    expect(model.dispose).toHaveBeenCalledOnce();
    expect(onFinal).not.toHaveBeenCalled();
    expect(onProvisional).not.toHaveBeenCalled();
  });
});
