import { EventLogPlugin } from '@katakit/core';
import type { TranscriptionSegment } from '@katakit/transcription';
import { BingoPlugin } from './bingo/plugin';
import type { useBingoKatakit } from './bingo/useBingoKatakit';
import { wordLists } from './bingo/wordLists';

export type PanelGame = NonNullable<ReturnType<typeof useBingoKatakit>>;
export type SavedBoard = { squares: string[]; overrides: Record<number, boolean> };

export const readSquares = (value: unknown, wordListId: unknown): string[] | undefined => {
  if (
    !Array.isArray(value) ||
    value.length !== 25 ||
    !value.every(s => typeof s === 'string' && s.trim())
  )
    return;
  const squares: string[] = [...value];
  // Older panels persisted a non-playable center. Keep the other 24 positions as saved.
  if (squares[12] === 'Free space') {
    const wordList = wordLists.find(wordList => wordList.id === wordListId) ?? wordLists[0];
    squares[12] = wordList.tiers.flat().find(phrase => !squares.includes(phrase))!;
  }
  return squares;
};

export const readSavedBoard = (value: unknown, wordListId: unknown): SavedBoard | undefined => {
  if (!value || typeof value !== 'object' || !('squares' in value)) return;
  const squares = readSquares(value.squares, wordListId);
  if (!squares) return;
  const overrides: Record<number, boolean> = {};
  if ('overrides' in value && value.overrides && typeof value.overrides === 'object') {
    for (const [key, marked] of Object.entries(value.overrides)) {
      const i = Number(key);
      if (Number.isInteger(i) && i >= 0 && i < squares.length && typeof marked === 'boolean')
        overrides[i] = marked;
    }
  }
  return { squares, overrides };
};

// Chrome can send segments between selecting a deal and React mounting its runtime.
export const createPanelDeal = (board: SavedBoard, key: number) => {
  let game: PanelGame | undefined;
  const pending: (TranscriptionSegment | 'flush')[] = [];
  const seen = new Set<string>();
  let previous: TranscriptionSegment | undefined;
  const deliver = (input: TranscriptionSegment | 'flush') => {
    if (!game) {
      pending.push(input);
      return;
    }
    if (input === 'flush') {
      game.flush();
      return;
    }
    const id = JSON.stringify([input.sourceId, input.id]);
    if (!input.text.trim() || seen.has(id)) return;
    seen.add(id);
    if (
      previous &&
      (previous.sourceId !== input.sourceId ||
        (input.startMs !== undefined &&
          previous.endMs !== undefined &&
          input.startMs - previous.endMs > 1400))
    )
      game.flush();
    previous = input;
    game.ingestUtterance(input);
  };
  return {
    key,
    squares: board.squares,
    deliver,
    attach: (next: PanelGame) => {
      game = next;
      const bingo = game.katakit.getMethods(BingoPlugin);
      for (const [index, marked] of Object.entries(board.overrides))
        bingo.changeSquare(Number(index), marked);
      pending.splice(0).forEach(deliver);
      return () => {
        game = undefined;
      };
    },
    savedBoard: (): SavedBoard => {
      const overrides = { ...board.overrides };
      for (const event of game?.katakit.getObservables(EventLogPlugin).events$.getAll() ?? []) {
        if (event.type === 'squareManuallyChanged') overrides[event.index] = event.marked;
      }
      return { squares: board.squares, overrides };
    },
  };
};
