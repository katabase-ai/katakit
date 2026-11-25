// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Bingo } from './BingoPanel';
import { defaultSquares } from './bingo';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const setup = () => {
  let resolveLocal!: (value: object) => void;
  let resolveSession!: (value: object) => void;
  const local = new Promise<object>(resolve => {
    resolveLocal = resolve;
  });
  const session = new Promise<object>(resolve => {
    resolveSession = resolve;
  });
  const listeners = new Set<(message: Record<string, unknown>) => void>();
  const writes = vi.fn(async () => {});
  const sendMessage = vi.fn(async () => ({ ok: true }));
  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: {
        addListener: (listener: (message: Record<string, unknown>) => void) =>
          listeners.add(listener),
        removeListener: (listener: (message: Record<string, unknown>) => void) =>
          listeners.delete(listener),
      },
      sendMessage,
    },
    storage: { local: { get: () => local, set: writes }, session: { get: () => session } },
  });
  return {
    resolveLocal,
    resolveSession,
    listeners,
    writes,
    sendMessage,
    dispatch: (message: Record<string, unknown>) =>
      act(() => {
        for (const listener of listeners) listener(message);
      }),
  };
};

it('hydrates before live messages, deduplicates overlap, and releases the panel on reopen', async () => {
  const host = setup();
  const first = render(<Bingo />);
  expect(screen.getByRole('status').textContent).toContain('Restoring');
  const segment = { sourceId: 'meeting', id: 'one', text: 'Quick question' };
  host.dispatch({ type: 'TRANSCRIPT_SEGMENT', segment });
  await act(async () => {
    host.resolveLocal({ board: { squares: defaultSquares, overrides: { 1: true } } });
    host.resolveSession({ segments: [segment] });
  });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /Quick question/ }).getAttribute('aria-pressed')
    ).toBe('true')
  );
  expect(screen.getByRole('button', { name: /Circle back/ }).getAttribute('aria-pressed')).toBe(
    'true'
  );
  expect(screen.getByLabelText('Transcript').textContent).not.toContain(
    'Quick question Quick question'
  );
  first.unmount();
  expect(host.listeners.size).toBe(0);
  expect(host.sendMessage).not.toHaveBeenCalled();
  render(<Bingo />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /Quick question/ }).getAttribute('aria-pressed')
    ).toBe('true')
  );
  expect(host.listeners.size).toBe(1);
});

it('a reset during storage reads prevents stale evidence and late reads cannot revive a closed panel', async () => {
  const host = setup();
  const view = render(<Bingo />);
  host.dispatch({ type: 'CAPTURE_RESET' });
  host.dispatch({
    type: 'TRANSCRIPT_SEGMENT',
    segment: { sourceId: 'new', id: 'one', text: 'Circle back' },
  });
  await act(async () => {
    host.resolveLocal({});
    host.resolveSession({ segments: [{ sourceId: 'old', id: 'one', text: 'Quick question' }] });
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Circle back/ }).getAttribute('aria-pressed')).toBe(
      'true'
    )
  );
  expect(screen.getByRole('button', { name: /Quick question/ }).getAttribute('aria-pressed')).toBe(
    'false'
  );
  view.unmount();
  const pending = setup();
  const closed = render(<Bingo />);
  closed.unmount();
  await act(async () => {
    pending.resolveLocal({});
    pending.resolveSession({ segments: [] });
  });
  expect(pending.listeners.size).toBe(0);
  expect(pending.writes).not.toHaveBeenCalled();
});
