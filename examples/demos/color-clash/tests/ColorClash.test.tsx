// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import type { TranscriptionState } from '@katakit/transcription';
import { TranscriptionError } from '@katakit/transcription';
import { ColorClash } from '../src/color-clash/ColorClash';
import { createColorClash } from '../src/color-clash/createColorClash';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test('mounting a replayed round does not finish it or start a display timer without capture', () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const original = createColorClash({ now: Date.now, random: () => 0 });
  original.begin();
  vi.advanceTimersByTime(1600);
  original.advance();
  const history = original.events$.getAll();
  const runtime = createColorClash({ now: Date.now, initialEvents: history });
  const stopped = vi.fn();
  render(
    <ColorClash
      runtime={runtime}
      input={{ phase: 'ready' }}
      disabled={false}
      onPlay={async () => false}
      onStop={stopped}
      onCancel={() => undefined}
    />
  );
  act(() => vi.advanceTimersByTime(30000));
  expect(runtime.events$.getAll()).toHaveLength(history.length);
  expect(runtime.getSnapshot().phase).toBe('playing');
  expect(stopped).not.toHaveBeenCalled();
  original.close();
  runtime.close();
});

test('explains a microphone denial and retries without spending the round time', async () => {
  const runtime = createColorClash();
  const retried = vi.fn();
  const Host = () => {
    const [input, setInput] = useState<TranscriptionState>({
      phase: 'error',
      error: new TranscriptionError('microphone-permission-denied', 'Permission denied'),
    });
    return (
      <ColorClash
        runtime={runtime}
        input={input}
        disabled={false}
        onPlay={async () => {
          retried();
          setInput({ phase: 'running' });
          return true;
        }}
        onStop={() => setInput({ phase: 'ready' })}
        onCancel={() => setInput({ phase: 'ready' })}
      />
    );
  };
  render(<Host />);
  const alert = screen.getByRole('alert');
  expect(alert.textContent).toContain('Microphone access needed');
  expect(alert.textContent).toContain('allow Microphone in site settings');
  expect(alert.textContent).not.toContain('Permission denied');
  expect(screen.getByText('How to enable it')).toBeTruthy();
  expect(runtime.getSnapshot().remainingMs).toBe(20000);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Try microphone again' }));
  });
  expect(retried).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('Say the ink color');
  expect(runtime.getSnapshot().remainingMs).toBe(20000);
  runtime.close();
});

test('retains a distinct retry for failures unrelated to microphone permission', () => {
  const runtime = createColorClash();
  render(
    <ColorClash
      runtime={runtime}
      input={{
        phase: 'error',
        error: new TranscriptionError('model-load-failed', 'Model unavailable'),
      }}
      disabled={false}
      onPlay={async () => false}
      onStop={() => undefined}
      onCancel={() => undefined}
    />
  );
  expect(screen.getByRole('alert').textContent).toContain('Model unavailable');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  expect(screen.queryByText('How to enable it')).toBeNull();
  runtime.close();
});

test('retry waits for an asynchronous microphone start rather than clearing the request on the previous error', async () => {
  const runtime = createColorClash();
  let completeStart!: () => void;
  const Host = () => {
    const [input, setInput] = useState<TranscriptionState>({
      phase: 'error',
      error: new TranscriptionError('model-load-failed', 'Model unavailable'),
    });
    return (
      <ColorClash
        runtime={runtime}
        input={input}
        disabled={false}
        onPlay={async () => {
          await new Promise<void>(resolve => {
            completeStart = resolve;
          });
          setInput({ phase: 'running' });
          return true;
        }}
        onStop={() => setInput({ phase: 'ready' })}
        onCancel={() => setInput({ phase: 'ready' })}
      />
    );
  };
  render(<Host />);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Try again' })));
  expect(runtime.getSnapshot().phase).toBe('ready');
  await act(async () => completeStart());
  expect(runtime.getSnapshot().phase).toBe('instructions');
  runtime.close();
});

test('cancelling pending setup leaves the round ready even when Play completes later', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const runtime = createColorClash({ now: Date.now });
  const cancelled = vi.fn();
  let finishStart!: () => void;
  const Host = () => {
    const [input, setInput] = useState<TranscriptionState>({ phase: 'ready' });
    return (
      <ColorClash
        runtime={runtime}
        input={input}
        disabled={false}
        onPlay={async () => {
          setInput({ phase: 'loading' });
          await new Promise<void>(resolve => {
            finishStart = resolve;
          });
          return true;
        }}
        onCancel={() => {
          cancelled();
          setInput({ phase: 'ready' });
        }}
        onStop={() => undefined}
      />
    );
  };
  render(<Host />);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play' })));
  expect(runtime.getSnapshot().phase).toBe('ready');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel setup' }));
  expect(cancelled).toHaveBeenCalledOnce();
  await act(async () => finishStart());
  act(() => vi.advanceTimersByTime(30000));
  expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(false);
  expect(runtime.getSnapshot()).toMatchObject({ phase: 'ready', remainingMs: 20000 });
  runtime.close();
});

test('a host error takes priority over an earlier microphone permission error', () => {
  const runtime = createColorClash();
  render(
    <ColorClash
      runtime={runtime}
      input={{
        phase: 'error',
        error: new TranscriptionError('microphone-permission-denied', 'Permission denied'),
      }}
      error="Host connection unavailable"
      disabled={false}
      onPlay={async () => false}
      onStop={() => undefined}
      onCancel={() => undefined}
    />
  );
  expect(screen.getByRole('alert').textContent).toContain('Host connection unavailable');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  expect(screen.queryByText('How to enable it')).toBeNull();
  runtime.close();
});

test('a replay keeps newly acquired capture instead of stopping it as part of the previous round', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const runtime = createColorClash({ now: Date.now });
  const stopped = vi.fn();
  const Host = () => {
    const [input, setInput] = useState<TranscriptionState>({ phase: 'ready' });
    return (
      <ColorClash
        runtime={runtime}
        input={input}
        disabled={false}
        onPlay={async () => {
          setInput({ phase: 'running' });
          return true;
        }}
        onStop={() => {
          stopped();
          setInput({ phase: 'ready' });
        }}
        onCancel={() => setInput({ phase: 'ready' })}
      />
    );
  };
  render(<Host />);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  });
  act(() => {
    vi.advanceTimersByTime(21600);
  });
  expect(screen.getByRole('heading', { name: 'Time’s up' })).toBeTruthy();
  expect(stopped).toHaveBeenCalledTimes(1);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
  });
  expect(screen.getByRole('status').textContent).toContain('Say the ink color');
  act(() => {
    vi.advanceTimersByTime(2000);
  });
  expect(runtime.getSnapshot().phase).toBe('playing');
  expect(stopped).toHaveBeenCalledTimes(1);
  act(() => {
    vi.advanceTimersByTime(20000);
  });
  expect(stopped).toHaveBeenCalledTimes(2);
  runtime.close();
});

test('prevents replay and requests stop only once while the host is tearing down capture', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const runtime = createColorClash({ now: Date.now });
  const stopped = vi.fn();
  const Host = ({ version }: { version: number }) => {
    const [input, setInput] = useState<TranscriptionState>({ phase: 'ready' });
    return (
      <ColorClash
        runtime={runtime}
        input={input}
        disabled={false}
        onPlay={async () => {
          setInput({ phase: 'running' });
          return true;
        }}
        onStop={() => stopped(version)}
        onCancel={() => setInput({ phase: 'ready' })}
      />
    );
  };
  const view = render(<Host version={1} />);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  });
  act(() => vi.advanceTimersByTime(21600));
  expect(stopped).toHaveBeenCalledTimes(1);
  expect((screen.getByRole('button', { name: 'Play again' }) as HTMLButtonElement).disabled).toBe(
    true
  );
  view.rerender(<Host version={2} />);
  expect(stopped).toHaveBeenCalledTimes(1);
  runtime.close();
});
