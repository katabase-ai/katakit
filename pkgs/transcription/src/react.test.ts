// @vitest-environment happy-dom
import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { createMicrophoneTranscriber, type MicrophoneOptions } from './microphone';
import {
  useMicrophoneLevel,
  useMicrophoneTranscriber,
  useMicrophoneTranscriberCallbacks,
} from './react';

vi.mock('./microphone', () => ({ createMicrophoneTranscriber: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const setup = () => {
  const order: string[] = [];
  const transcribers: { options: MicrophoneOptions; stop: ReturnType<typeof vi.fn> }[] = [];
  vi.mocked(createMicrophoneTranscriber).mockImplementation(options => {
    const transcriber = {
      options,
      load: vi.fn(),
      start: vi.fn(async () => options.onState?.({ phase: 'running' })),
      stop: vi.fn(async () => {
        order.push('stop');
        options.onFinal({ id: 'last', sourceId: 'test', text: 'last words' });
        options.onStop?.();
        options.onState?.({ phase: 'ready' });
      }),
      dispose: vi.fn(async () => {
        order.push('dispose');
      }),
    };
    transcribers.push(transcriber);
    return transcriber;
  });
  const sinks: { ingestSegment: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }[] = [];
  const createSink = () => {
    const sink = {
      ingestSegment: vi.fn(() => order.push('segment')),
      flush: vi.fn(() => order.push('flush')),
      close: vi.fn(() => order.push('close')),
    };
    sinks.push(sink);
    return sink;
  };
  return { order, transcribers, sinks, createSink };
};

test('unmount while listening drains the last segment before closing the sink', async () => {
  const { order, sinks, createSink } = setup();
  const view = renderHook(() => useMicrophoneTranscriber({ createSink }));
  expect(view.result.current.sink).toBe(sinks[0]);
  expect(view.result.current.listening).toBe(false);

  await act(() => view.result.current.toggle());
  expect(view.result.current.listening).toBe(true);

  view.unmount();
  await vi.waitFor(() => expect(sinks[0]!.close).toHaveBeenCalledOnce());
  expect(order).toEqual(['stop', 'segment', 'flush', 'dispose', 'close']);
});

test('toggle stops a running session and forwards level, provisional text, and state', async () => {
  const { transcribers } = setup();
  const onProvisionalUtterance = vi.fn();
  const view = renderHook(() => {
    const microphone = useMicrophoneTranscriber();
    const level = useMicrophoneLevel(microphone);
    useMicrophoneTranscriberCallbacks(microphone, { onProvisionalUtterance });
    return { microphone, level };
  });
  await act(() => view.result.current.microphone.toggle());
  act(() => transcribers[0]!.options.onLevel?.(0.5));
  expect(view.result.current.level).toBe(0.5);
  act(() => transcribers[0]!.options.onProvisional?.('partial words'));
  expect(onProvisionalUtterance).toHaveBeenCalledWith('partial words');

  await act(() => view.result.current.microphone.toggle());
  expect(transcribers[0]!.stop).toHaveBeenCalledOnce();
  expect(view.result.current.microphone.listening).toBe(false);

  act(() => transcribers[0]!.options.onState?.({ phase: 'loading', progress: 0.5 }));
  expect(view.result.current.microphone.busy).toBe(true);
});

test('Strict Mode closes the discarded session and keeps one live sink', async () => {
  const { sinks, createSink } = setup();
  const view = renderHook(() => useMicrophoneTranscriber({ createSink }), { wrapper: StrictMode });
  await vi.waitFor(() => expect(sinks[0]!.close).toHaveBeenCalledOnce());
  expect(sinks).toHaveLength(2);
  expect(view.result.current.sink).toBe(sinks[1]);
  expect(sinks[1]!.close).not.toHaveBeenCalled();
});
