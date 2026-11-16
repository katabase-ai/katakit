// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import type { TranscriptionState } from '@katakit/transcription';
import { ColorClash } from './ColorClash';
import { createColorClash } from './createColorClash';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
    fireEvent.click(screen.getByRole('button', { name: 'Play · 20s' }));
  });
  act(() => {
    vi.advanceTimersByTime(21600);
  });
  expect(screen.getByText('Round complete')).toBeTruthy();
  expect(stopped).toHaveBeenCalledTimes(1);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Play again · 20s' }));
  });
  expect(screen.getByRole('status').textContent).toContain('Say the ink color');
  act(() => {
    vi.advanceTimersByTime(2000);
  });
  expect(runtime.getSnapshot().phase).toBe('playing');
  expect(stopped).toHaveBeenCalledTimes(1);
  runtime.close();
});
