import { EventLogPlugin, makeKatakit, type KatakitEvent } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import type { ConversationTurnAddedEvent } from '@katakit/transcript-ingestion';
import { afterEach, expect, test, vi } from 'vitest';
import { BingoPlugin } from '../src/bingo/plugin';

const squares = Array.from({ length: 25 }, (_, i) => `phrase ${i}`);

const createKit = (existingEvents: KatakitEvent[] = []) => {
  const ingestion = makeTranscriptIngestionPlugin();
  const kit = makeKatakit({
    existingEvents,
    plugins: [
      ingestion.configure({}),
      BingoPlugin.configure({ TranscriptIngestionPlugin: ingestion }),
    ],
  });
  return { kit, ingestion };
};

const startRound = () => {
  const { kit, ingestion } = createKit();
  const live = kit.start();
  const bingo = live.getMethods(BingoPlugin);
  bingo.startGame(squares);
  return {
    bingo,
    input: live.getMethods(ingestion),
    board: live.getObservables(BingoPlugin),
    history: live.getObservables(EventLogPlugin).events$,
    emitEvent: live.getMethods(EventLogPlugin).emitEvent,
  };
};

afterEach(() => vi.useRealTimers());

test('only a completed turn marks matching squares; full history replays without matching again', async () => {
  vi.useFakeTimers();
  const { bingo, input, board, history } = startRound();
  const checkReplay = () => {
    const facts = history.getAll();
    const { kit } = createKit(facts);
    const replay = kit.getObservables(BingoPlugin);
    expect(replay.squares$.get()).toEqual(board.squares$.get());
    expect(replay.marked$.get()).toEqual(board.marked$.get());
    expect(replay.winningLanes$.get()).toEqual(board.winningLanes$.get());
    kit.start();
    expect(kit.getObservables(EventLogPlugin).events$.getAll()).toEqual(facts);
    expect(replay.marked$.get()).toEqual(board.marked$.get());
  };
  expect(board.squares$.get()).toEqual(squares);
  expect(Object.values(board.marked$.get()!)).toEqual(Array(25).fill(false));
  checkReplay();

  input.updateProvisionalUtterance({ speaker: 'mic', text: 'phrase 0' });
  input.ingestUtterance({ id: 'a', speaker: 'mic', text: 'phrase', startMs: 0, endMs: 100 });
  input.ingestUtterance({
    id: 'b',
    speaker: 'mic',
    text: '0, phrase 1!',
    startMs: 100,
    endMs: 250,
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(board.marked$.get()).toMatchObject({ 0: false, 1: false });
  input.flush();
  await vi.advanceTimersByTimeAsync(0);
  expect(board.marked$.get()).toMatchObject({ 0: true, 1: true });
  expect(
    history
      .getAll()
      .filter(e => e.type === 'squareSpoken')
      .map(e => e.index)
  ).toEqual([0, 1]);
  checkReplay();

  for (const i of [2, 3, 4]) bingo.changeSquare(i, true);
  expect(board.winningLanes$.get()).toEqual([[0, 1, 2, 3, 4]]);
  checkReplay();
  bingo.changeSquare(0, false);
  expect(board.winningLanes$.get()).toEqual([]);
  checkReplay();
});

test('a marked earlier square does not hide later matches and distinct turns are queued', async () => {
  const { bingo, board, history, emitEvent } = startRound();
  bingo.changeSquare(0, true);
  for (const index of [1, 2])
    emitEvent({
      type: 'conversationTurnAdded',
      id: `turn-${index}`,
      text: `phrase ${index}`,
      startMs: index * 100,
      endMs: index * 100 + 50,
    } satisfies Omit<ConversationTurnAddedEvent, 'meta'>);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(board.marked$.get()).toMatchObject({ 0: true, 1: true, 2: true });
  expect(
    history
      .getAll()
      .filter(event => event.type === 'squareSpoken')
      .map(event => event.index)
  ).toEqual([1, 2]);
});

test('requires an opening deal, allows marking the center, and rejects a second deal', () => {
  const { kit } = createKit();
  const live = kit.start();
  const bingo = live.getMethods(BingoPlugin);
  const board = live.getObservables(BingoPlugin);
  const history = live.getObservables(EventLogPlugin).events$;
  expect(board.squares$.get()).toBeNull();
  expect(() => bingo.changeSquare(0, true)).toThrow('Missing opening bingo card');
  expect(history.getAll()).toHaveLength(0);
  bingo.startGame(squares);
  bingo.changeSquare(12, true);
  bingo.changeSquare(12, true);
  expect(board.marked$.get()?.[12]).toBe(true);
  expect(() => bingo.startGame(squares)).toThrow('Start a new runtime');
  expect(history.getAll().map(e => e.type)).toEqual(['gameStarted', 'squareManuallyChanged']);
});

test('rejects malformed cards and square changes without recording them', () => {
  const { kit } = createKit();
  const live = kit.start();
  const bingo = live.getMethods(BingoPlugin);
  const history = live.getObservables(EventLogPlugin).events$;
  expect(() => bingo.startGame(squares.slice(1))).toThrow('25 nonempty phrases');
  expect(() => bingo.startGame([...squares.slice(0, 24), ''])).toThrow('25 nonempty phrases');
  expect(history.getAll()).toHaveLength(0);
  bingo.startGame(squares);
  for (const index of [-1, 25, 0.5, NaN])
    expect(() => bingo.changeSquare(index, true)).toThrow('Invalid Bingo square change');
  expect(() => bingo.changeSquare(0, 'yes' as unknown as boolean)).toThrow(
    'Invalid Bingo square change'
  );
  expect(history.getAll().map(event => event.type)).toEqual(['gameStarted']);
});
