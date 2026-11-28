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
  const transcribers: {
    options: MicrophoneOptions;
    stop: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }[] = [];
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
  return { order, transcribers };
};

test('unmount while listening stops capture, emits the final segment and flush, then disposes and closes', async () => {
  const { order } = setup();
  const view = renderHook(() => useMicrophoneTranscriber());
  const { emitter } = view.result.current;
  emitter.on('utterance', segment => order.push(segment.text));
  emitter.on('flush', () => order.push('flush'));
  emitter.on('close', () => order.push('close'));
  expect(view.result.current.listening).toBe(false);

  await act(() => view.result.current.toggle());
  expect(view.result.current.listening).toBe(true);

  view.unmount();
  await vi.waitFor(() =>
    expect(order).toEqual(['stop', 'last words', 'flush', 'dispose', 'close'])
  );
});

test('an owned sink stays attached through an asynchronous unmount drain', async () => {
  const order: string[] = [];
  let finishStop!: () => void;
  vi.mocked(createMicrophoneTranscriber).mockImplementation(options => ({
    load: vi.fn(),
    start: vi.fn(async () => options.onState?.({ phase: 'running' })),
    stop: vi.fn(
      () =>
        new Promise<void>(resolve => {
          finishStop = () => {
            options.onFinal({ id: 'last', sourceId: 'mic', text: 'last words' });
            options.onStop?.();
            resolve();
          };
        })
    ),
    dispose: vi.fn(async () => {
      order.push('dispose');
    }),
  }));
  const createSink = () => ({
    ingestSegment: (segment: { text: string }) => {
      order.push(segment.text);
    },
    flush: () => {
      order.push('flush');
    },
    close: () => {
      order.push('close');
    },
  });
  const view = renderHook(() => useMicrophoneTranscriber({ createSink }));
  await act(() => view.result.current.toggle());
  view.unmount();
  expect(order).toEqual([]);
  finishStop();
  await vi.waitFor(() => expect(order).toEqual(['last words', 'flush', 'dispose', 'close']));
});

test('unmount waits for a stop already in progress before disposing the sink', async () => {
  const order: string[] = [];
  const drain = Promise.withResolvers<void>();
  let disposed = false;
  let stopping: Promise<void> | undefined;
  vi.mocked(createMicrophoneTranscriber).mockImplementation(options => ({
    load: vi.fn(),
    start: vi.fn(async () => options.onState?.({ phase: 'running' })),
    stop: vi.fn(() => {
      stopping ??= (async () => {
        options.onState?.({ phase: 'stopping' });
        await drain.promise;
        if (!disposed) options.onFinal({ id: 'last', sourceId: 'mic', text: 'last words' });
        options.onStop?.();
      })();
      return stopping;
    }),
    dispose: vi.fn(async () => {
      disposed = true;
      order.push('dispose');
    }),
  }));
  const createSink = () => ({
    ingestSegment: (segment: { text: string }) => order.push(segment.text),
    close: () => order.push('close'),
  });
  const view = renderHook(() => useMicrophoneTranscriber({ createSink }));
  await act(() => view.result.current.toggle());
  const stoppingToggle = view.result.current.toggle();
  view.unmount();
  expect(order).toEqual([]);
  drain.resolve();
  await stoppingToggle;
  await vi.waitFor(() => expect(order).toEqual(['last words', 'dispose', 'close']));
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

test('Strict Mode disposes the discarded transcriber and keeps the replacement usable', async () => {
  const { transcribers } = setup();
  const view = renderHook(() => useMicrophoneTranscriber(), { wrapper: StrictMode });
  expect(transcribers).toHaveLength(2);
  expect(transcribers[0]!.dispose).toHaveBeenCalledOnce();
  await act(() => view.result.current.toggle());
  expect(view.result.current.listening).toBe(true);
  expect(transcribers[1]!.dispose).not.toHaveBeenCalled();
  view.unmount();
  await vi.waitFor(() => expect(transcribers[1]!.dispose).toHaveBeenCalledOnce());
});
