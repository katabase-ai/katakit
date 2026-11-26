import { EventLogPlugin, makeKatakit } from '@katakit/core';
import { afterEach, expect, test, vi } from 'vitest';
import { createBingoSession } from './useBingoKatakit';
import { BingoPlugin, defaultSquares, makeSquares } from './plugin';

afterEach(() => vi.useRealTimers());

test('each live board is reconstructed from its three Bingo facts before start', () => {
  vi.useFakeTimers();
  const game = createBingoSession();
  const checkReplay = () => {
    // Speech payloads are unnecessary: the decisions about which squares matched are recorded.
    const existingEvents = game.history
      .getAll()
      .filter(e => ['gameStarted', 'squareManuallyChanged', 'squareSpoken'].includes(e.type));
    const replay = makeKatakit({ existingEvents, plugins: [BingoPlugin.configure({})] });
    expect(replay.getObservables(BingoPlugin).state$.get()).toEqual(game.board$.get());
  };
  checkReplay();
  game.updateProvisional('Quick question');
  expect(game.board$.get().marked[0]).toBe(false);
  game.ingestSegment({ sourceId: 'mic', id: 'a', text: 'Quick' });
  checkReplay();
  const final = { sourceId: 'mic', id: 'b', text: 'question, circle back!' };
  game.ingestSegment(final);
  game.ingestSegment(final);
  expect(game.board$.get().spoken.slice(0, 2)).toEqual([true, true]);
  checkReplay();
  for (const i of [2, 3, 4]) game.changeSquare(i, true);
  expect(game.board$.get().winningLines).toContainEqual([0, 1, 2, 3, 4]);
  checkReplay();
  game.changeSquare(0, false);
  game.flush();
  game.ingestSegment({ ...final, id: 'c', text: 'Quick question' });
  expect(game.board$.get()).toMatchObject({ winningLines: [], overrides: { 0: false } });
  expect(game.board$.get().marked[0]).toBe(false);
  expect(
    game.history
      .getAll()
      .filter(e => e.type === 'squareSpoken')
      .map(e => e.index)
  ).toEqual([0, 1]);
  checkReplay();
  game.close();
});

test('a new deal switches live input and subscriptions to an independent log', () => {
  vi.useFakeTimers();
  const game = createBingoSession();
  const first = game.history;
  const completed = vi.fn();
  game.board$.subscribe({ complete: completed });
  game.ingestSegment({ sourceId: 'mic', id: 'first', text: 'Quick question; a tiger' });
  const oldEvents = first.getAll();
  game.restart(makeSquares(['Tiger', ...defaultSquares.slice(0, 23)]));
  expect(game.history.getAll()).toEqual([
    expect.objectContaining({
      type: 'gameStarted',
      squares: [game.board$.get().squares],
      meta: { seq: 0, timestamp: expect.any(Date) },
    }),
  ]);
  expect(game.transcript$.get().pending).toBeNull();
  expect(game.board$.get().marked.filter(Boolean)).toHaveLength(1);
  game.ingestSegment({ sourceId: 'mic', id: 'first', text: 'Tiger' });
  expect(game.board$.get().spoken[0]).toBe(true);
  vi.runAllTimers();
  expect(first.getAll()).toEqual(oldEvents);
  game.close();
  expect(completed).toHaveBeenCalledOnce();
});

test('invalid commands append nothing and the opening deal cannot be repeated', () => {
  const kit = makeKatakit({ plugins: [BingoPlugin.configure({})] }).start();
  const bingo = kit.getMethods(BingoPlugin);
  const history = kit.getObservables(EventLogPlugin).events$;
  expect(() => bingo.changeSquare(3, true)).toThrow('Missing opening bingo card');
  expect(() => bingo.startGame([])).toThrow('24 phrases and a free center');
  expect(history.getAll()).toEqual([]);
  bingo.startGame(defaultSquares);
  expect(() => bingo.startGame(defaultSquares)).toThrow('Start a new runtime');
  expect(() => bingo.changeSquare(12, false)).toThrow('Invalid bingo square index');
  expect(history.getAll()).toHaveLength(1);
  const [opening] = history.getAll();
  const replay = makeKatakit({
    existingEvents: [opening!, opening!],
    plugins: [BingoPlugin.configure({})],
  });
  expect(() => replay.getObservables(BingoPlugin)).toThrow('exactly one card');
});
