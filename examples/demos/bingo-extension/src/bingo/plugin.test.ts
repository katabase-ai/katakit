import { EventLogPlugin, makeKatakit } from '@katakit/core';
import { afterEach, expect, test, vi } from 'vitest';
import { createBingoSession } from './createBingoSession';
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
  // Shared close finalizes live pending input once before disposing the old round.
  const closedEvents = first.getAll();
  expect(closedEvents.slice(0, oldEvents.length)).toEqual(oldEvents);
  expect(closedEvents.slice(oldEvents.length)).toEqual([
    expect.objectContaining({ type: 'conversationTurnAdded' }),
  ]);
  expect(game.history.getAll()).toEqual([
    expect.objectContaining({
      type: 'gameStarted',
      cards: [game.board$.get().squares],
      meta: { seq: 0, timestamp: expect.any(Date) },
    }),
  ]);
  expect(game.transcript$.get().pending).toBeNull();
  expect(game.board$.get().marked.filter(Boolean)).toHaveLength(1);
  game.ingestSegment({ sourceId: 'mic', id: 'first', text: 'Tiger' });
  expect(game.board$.get().spoken[0]).toBe(true);
  vi.runAllTimers();
  expect(first.getAll()).toEqual(closedEvents);
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

test('session preserves input identity and publishes atomic turn boundaries', () => {
  vi.useFakeTimers();
  const game = createBingoSession();
  const first = { sourceId: 'mic', id: 'one', speaker: 'Ada', text: 'Quick' };
  game.ingestSegment(first);
  game.ingestSegment(first);
  game.ingestSegment({ ...first, id: 'two', text: 'question', startMs: 10, endMs: 20 });
  expect(game.board$.get().spoken[0]).toBe(true);
  expect(game.history.getAll().filter(event => event.type === 'utteranceAdded')).toEqual([
    { ...first, type: 'utteranceAdded', meta: expect.any(Object) },
    {
      ...first,
      id: 'two',
      text: 'question',
      startMs: 10,
      endMs: 20,
      type: 'utteranceAdded',
      meta: expect.any(Object),
    },
  ]);
  const snapshots: ReturnType<typeof game.transcript$.get>[] = [];
  const subscription = game.transcript$.subscribe(state => snapshots.push(state));
  game.ingestSegment({ ...first, id: 'three', speaker: 'Grace', text: 'Circle back' });
  expect(game.transcript$.get().completed).toHaveLength(1);
  expect(game.transcript$.get().pending?.speaker).toBe('Grace');
  expect(
    snapshots.every(
      state => !state.pending || !state.completed.some(turn => turn.id === state.pending!.id)
    )
  ).toBe(true);
  subscription.unsubscribe();
  game.close();
  expect(vi.getTimerCount()).toBe(0);
});

test('close finalizes once and replay neither schedules nor appends', () => {
  vi.useFakeTimers();
  const game = createBingoSession();
  game.ingestSegment({ sourceId: 'mic', id: 'one', text: 'Quick question' });
  const history = game.history;
  game.close();
  const events = history.getAll();
  expect(events.filter(event => event.type === 'conversationTurnAdded')).toHaveLength(1);
  game.close();
  game.flush();
  game.ingestSegment({ sourceId: 'mic', id: 'late', text: 'Circle back' });
  game.changeSquare(1, true);
  game.restart(defaultSquares);
  const replay = makeKatakit({ existingEvents: events, plugins: [BingoPlugin.configure({})] });
  expect(replay.getObservables(BingoPlugin).state$.get()?.spoken.slice(0, 2)).toEqual([
    true,
    false,
  ]);
  expect(replay.getObservables(EventLogPlugin).events$.getAll()).toEqual(events);
  expect(vi.getTimerCount()).toBe(0);
  vi.runAllTimers();
  expect(history.getAll()).toEqual(events);
});
