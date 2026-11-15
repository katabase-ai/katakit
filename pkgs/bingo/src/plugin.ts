import { makeKatakitPlugin, property } from '@katakit/core';
import { BehaviorSubject } from 'rxjs';

export type BingoTurn = { id: string; text: string };
export type BingoBoard = { squares: string[]; overrides: Record<number, boolean> };
export type BingoState = BingoBoard & {
  evidence: (string | undefined)[];
  marked: boolean[];
  winningLines: number[][];
};

export const defaultSquares = [
  'Quick question',
  'Circle back',
  'Can you hear me',
  'Next steps',
  'One more thing',
  'On the same page',
  'Let me share',
  'A little context',
  'Good point',
  'Follow up',
  'Before we start',
  'Make sense',
  'Free space',
  'Let us revisit',
  'Any questions',
  'Action item',
  'Take this offline',
  'To be clear',
  'Sounds good',
  'Moving forward',
  'Timeline',
  'Just to clarify',
  'We have time',
  'I agree',
  'Thanks everyone',
];

export const normalizePhrase = (text: string) =>
  text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export const matchPhrase = (phrase: string, transcript: string) => {
  const needle = normalizePhrase(phrase);
  return !!needle && ` ${normalizePhrase(transcript)} `.includes(` ${needle} `);
};

export const makeSquares = (phrases: string[]) => {
  if (phrases.length !== 24 || phrases.some(phrase => !normalizePhrase(phrase)))
    throw new Error('A bingo card needs exactly 24 nonblank phrases.');
  const squares = [...phrases];
  squares.splice(12, 0, 'Free space');
  return squares;
};

const validateSquares = (squares: string[]) => {
  if (
    squares.length !== 25 ||
    squares[12] !== 'Free space' ||
    squares.some((phrase, index) => index !== 12 && !normalizePhrase(phrase))
  )
    throw new Error('A bingo card needs 24 phrases and a free center square.');
};

const validateOverrides = (overrides: Record<number, boolean>) => {
  for (const [key, value] of Object.entries(overrides)) {
    const index = Number(key);
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= 25 ||
      index === 12 ||
      typeof value !== 'boolean'
    )
      throw new Error('Invalid bingo square override.');
  }
};

export const winningLines = (marked: boolean[]) => {
  const lines: number[][] = [];
  for (let row = 0; row < 5; row++)
    lines.push(Array.from({ length: 5 }, (_, col) => row * 5 + col));
  for (let col = 0; col < 5; col++)
    lines.push(Array.from({ length: 5 }, (_, row) => row * 5 + col));
  lines.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return lines.filter(line => line.every(index => marked[index]));
};

const calculate = (board: BingoBoard, turns: BingoTurn[]): BingoState => {
  const normalizedTurns = turns.map(turn => ({
    text: turn.text,
    normalized: normalizePhrase(turn.text),
  }));
  const evidence = board.squares.map((phrase, index) => {
    if (index === 12) return undefined;
    const needle = ` ${normalizePhrase(phrase)} `;
    return normalizedTurns.find(turn => ` ${turn.normalized} `.includes(needle))?.text;
  });
  const marked = board.squares.map(
    (_, index) => index === 12 || (board.overrides[index] ?? !!evidence[index])
  );
  return {
    squares: [...board.squares],
    overrides: { ...board.overrides },
    evidence,
    marked,
    winningLines: winningLines(marked),
  };
};

/** A headless card driven by source-neutral transcript turns, not audio or React. */
export const makeBingoPlugin = () =>
  makeKatakitPlugin({
    type: 'Bingo',
    configure: (_options: {}) => ({
      state: new BehaviorSubject<BingoState>(
        calculate({ squares: defaultSquares, overrides: {} }, [])
      ),
    }),
    observables: ({ options }) => ({ state$: property(options.state.asObservable()) }),
    methods: ({ options, observables }) => {
      const { state$ } = observables;
      let turns: BingoTurn[] = [];
      let board: BingoBoard = { squares: [...defaultSquares], overrides: {} };
      const update = () => options.state.next(calculate(board, turns));
      return {
        /** Replace the current transcript view, including any in-progress finalized turn. */
        setTurns: (next: BingoTurn[]) => {
          if (
            next.length === turns.length &&
            next.every(
              (turn, index) => turn.id === turns[index]?.id && turn.text === turns[index]?.text
            )
          )
            return;
          turns = next.map(turn => ({ id: turn.id, text: turn.text }));
          update();
        },
        setSquares: (squares: string[]) => {
          validateSquares(squares);
          board = { squares: [...squares], overrides: {} };
          update();
        },
        restoreBoard: (snapshot: BingoBoard) => {
          validateSquares(snapshot.squares);
          validateOverrides(snapshot.overrides);
          board = { squares: [...snapshot.squares], overrides: { ...snapshot.overrides } };
          update();
        },
        setOverride: (index: number, value: boolean | undefined) => {
          if (!Number.isInteger(index) || index < 0 || index >= 25 || index === 12)
            throw new Error('Invalid bingo square index.');
          const overrides = { ...state$.get().overrides };
          if (value === undefined) delete overrides[index];
          else overrides[index] = value;
          board = { squares: board.squares, overrides };
          update();
        },
      };
    },
  });
