import { EventLogPlugin, makeKatakit, type KatakitEvent } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import { afterEach, expect, test, vi } from 'vitest';
import { BingoPlugin } from './plugin';

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
  };
};

afterEach(() => vi.useRealTimers());

test('only a completed turn marks matching squares; Bingo events alone replay the board', async () => {
  vi.useFakeTimers();
  const { bingo, input, board, history } = startRound();
  const checkReplay = () => {
    const facts = history
      .getAll()
      .filter(e => ['gameStarted', 'squareSpoken', 'squareManuallyChanged'].includes(e.type));
    const { kit } = createKit(facts);
    const replay = kit.getObservables(BingoPlugin);
    expect(replay.squares$.get()).toEqual(board.squares$.get());
    expect(replay.marked$.get()).toEqual(board.marked$.get());
    expect(replay.winningLanes$.get()).toEqual(board.winningLanes$.get());
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
