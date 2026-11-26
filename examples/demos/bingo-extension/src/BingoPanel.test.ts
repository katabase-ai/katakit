// @vitest-environment happy-dom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Bingo } from './BingoPanel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('restores an older saved card, consumes buffered speech, and routes new input to the shuffled deal', async () => {
  const squares = Array.from({ length: 25 }, (_, index) => `saved ${index}`);
  squares[12] = 'Free space';
  const saved = { squares, overrides: { 2: true } };
  const write = vi.fn().mockResolvedValue(undefined);
  const send = vi.fn().mockResolvedValue({ ok: true });
  const add = vi.fn();
  const remove = vi.fn();
  vi.stubGlobal('chrome', {
    storage: {
      local: { get: async () => ({ board: saved, packId: 'meeting' }), set: write },
      session: {
        get: async () => ({
          segments: [{ id: 'saved', sourceId: 'tab', text: 'saved 0' }],
          capture: { phase: 'idle' },
        }),
      },
    },
    runtime: { sendMessage: send, onMessage: { addListener: add, removeListener: remove } },
  });
  const view = render(createElement(Bingo));
  const board = () =>
    within(screen.getByRole('group', { name: 'Click squares to mark or correct them' }));
  await screen.findByText('2 of 25 squares');
  expect(board().getByRole('button', { name: 'saved 0 Heard' }).getAttribute('aria-pressed')).toBe(
    'true'
  );
  expect(board().getByRole('button', { name: 'saved 2' }).getAttribute('aria-pressed')).toBe(
    'true'
  );
  const center = board().getAllByRole('button')[12]!;
  expect(center.textContent).not.toBe('Free space');
  fireEvent.click(center);
  expect(write).toHaveBeenLastCalledWith({
    board: {
      squares: expect.any(Array),
      overrides: { 2: true, 12: true },
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Shuffle' }));
  expect(send).toHaveBeenCalledWith({ type: 'BINGO_NEW_ROUND' });
  await screen.findByText('0 of 25 squares');
  const next = board().getAllByRole('button')[0]!;
  const listener = add.mock.calls[0]![0];
  await act(async () => {
    listener({
      type: 'TRANSCRIPT_SEGMENT',
      segment: { id: 'saved', sourceId: 'tab', text: next.textContent },
    });
    listener({ type: 'CAPTURE_STATUS', phase: 'idle' });
  });
  expect(next.getAttribute('aria-pressed')).toBe('true');
  view.unmount();
  expect(remove).toHaveBeenCalledWith(listener);
});
