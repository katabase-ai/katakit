// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import type { TranscriptionState } from '@katakit/transcription';
import { TranscriptionError } from '@katakit/transcription';
import { ColorClash } from './ColorClash';
import { createColorClash } from './createColorClash';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
  expect(screen.getByText('How to enable your microphone')).toBeTruthy();
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
  expect(screen.getByRole('alert').textContent).toContain('Check your internet connection');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  expect(screen.queryByText('How to enable your microphone')).toBeNull();
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
  expect(screen.queryByText('How to enable your microphone')).toBeNull();
  runtime.close();
});

test('a blocked owner offers reload even if the input still reports model loading', () => {
  const runtime = createColorClash();
  const play = vi.fn(async () => false);
  const cancel = vi.fn();
  render(
    <ColorClash
      runtime={runtime}
      input={{ phase: 'loading', progress: 0.25 }}
      error="Capture cleanup failed"
      blocked
      disabled
      onPlay={play}
      onStop={() => undefined}
      onCancel={cancel}
    />
  );
  expect(screen.getByRole('alert').textContent).toContain('Capture cleanup failed');
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Cancel download' })).toBeNull();
  expect(play).not.toHaveBeenCalled();
  expect(cancel).not.toHaveBeenCalled();
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

test('the same focused action survives setup and cancellation instead of dropping focus to the page', async () => {
  const runtime = createColorClash();
  let finish!: (value: boolean) => void;
  const Host = () => {
    const [input, setInput] = useState<TranscriptionState>({ phase: 'idle' });
    return (
      <ColorClash
        runtime={runtime}
        input={input}
        disabled={false}
        onPlay={() => {
          setInput({ phase: 'loading', progress: 0.25 });
          return new Promise(resolve => {
            finish = resolve;
          });
        }}
        onCancel={() => {
          setInput({ phase: 'idle' });
          finish(false);
        }}
        onStop={() => {}}
      />
    );
  };
  const view = render(<Host />);
  const button = screen.getByRole('button', { name: 'Play' });
  button.focus();
  await act(async () => fireEvent.click(button));
  expect(screen.getByRole('button', { name: 'Cancel download' })).toBe(button);
  expect(document.activeElement).toBe(button);
  await act(async () => fireEvent.click(button));
  expect(screen.getByRole('button', { name: 'Play' })).toBe(button);
  expect(document.activeElement).toBe(button);
  expect(runtime.getSnapshot().remainingMs).toBe(20000);
  view.unmount();
  runtime.close();
});

test('an interrupted round announces its score without claiming the clock expired', () => {
  const runtime = createColorClash();
  runtime.begin();
  const view = render(
    <ColorClash
      runtime={runtime}
      input={{ phase: 'running' }}
      disabled={false}
      onPlay={async () => true}
      onStop={() => {}}
      onCancel={() => {}}
    />
  );
  act(() => runtime.finish());
  expect(screen.getByRole('heading', { name: 'Round ended' })).toBeDefined();
  expect(screen.queryByRole('heading', { name: 'Time’s up' })).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('Round ended. Your score is 0.');
  view.unmount();
  runtime.close();
});
