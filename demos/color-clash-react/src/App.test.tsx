// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  createMicrophoneTranscriber,
  type MicrophoneOptions,
} from '@katakit/transcription/browser';
import { App } from './App';

vi.mock('@katakit/transcription/browser', () => ({ createMicrophoneTranscriber: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const fixture = () => {
  const makeInput = (callbacks: MicrophoneOptions) => {
    const starting = Promise.withResolvers<void>();
    let disposed = false;
    let captures = 0;
    return {
      load: vi.fn(async () => undefined),
      start: vi.fn(async () => {
        callbacks.onState?.({ phase: 'loading' });
        await starting.promise;
        if (!disposed) {
          captures++;
          callbacks.onState?.({ phase: 'running' });
        }
      }),
      stop: vi.fn(async () => {
        callbacks.onState?.({ phase: 'ready' });
      }),
      dispose: vi.fn(async () => {
        disposed = true;
        starting.resolve();
        callbacks.onState?.({ phase: 'disposed' });
      }),
      captures: () => captures,
    };
  };
  const inputs: ReturnType<typeof makeInput>[] = [];
  vi.mocked(createMicrophoneTranscriber).mockImplementation(callbacks => {
    const input = makeInput(callbacks);
    inputs.push(input);
    return input;
  });
  return inputs;
};

test('mounting is inert and unmounting during setup prevents later microphone capture', async () => {
  const inputs = fixture();
  const view = render(<App />);
  expect(inputs[0]?.start).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  });
  await act(async () => {
    view.unmount();
  });
  expect(inputs[0]?.dispose).toHaveBeenCalledOnce();
  expect(inputs[0]?.captures()).toBe(0);
});

test('cancelling setup releases its input before offering a fresh microphone session', async () => {
  const inputs = fixture();
  render(<App />);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Cancel setup' }));
  });
  expect(inputs).toHaveLength(2);
  expect(inputs[0]?.dispose).toHaveBeenCalledOnce();
  expect(inputs[0]?.captures()).toBe(0);
  expect(inputs[1]?.start).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Play' }).hasAttribute('disabled')).toBe(false);
});
