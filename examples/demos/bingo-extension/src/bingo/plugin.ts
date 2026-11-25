import {
  EventLogPlugin,
  evolve,
  makeKatakitPlugin,
  optionalProperty,
  type KatakitEvent,
} from '@katakit/core';
import { filter, shareReplay } from 'rxjs';

export type BingoBoard = { squares: string[]; overrides: Record<number, boolean> };
export type BingoState = BingoBoard & {
  spoken: boolean[];
  marked: boolean[];
  winningLines: number[][];
};

type BingoChange =
  | { type: 'gameStarted'; cards: [string[]] }
  | { type: 'squareManuallyChanged'; index: number; marked: boolean }
  | { type: 'squareSpoken'; index: number };

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
    .toLowerCase()
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

export const validateSquares = (squares: string[]) => {
  if (
    squares.length !== 25 ||
    squares[12] !== 'Free space' ||
    squares.some((phrase, index) => index !== 12 && !normalizePhrase(phrase))
  )
    throw new Error('A bingo card needs 24 phrases and a free center square.');
};

export const validateBoard = ({ squares, overrides }: BingoBoard) => {
  validateSquares(squares);
  for (const [key, value] of Object.entries(overrides)) {
    const index = Number(key);
    if (
      key !== String(index) ||
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

const validateIndex = (index: number) => {
  if (!Number.isInteger(index) || index < 0 || index >= 25 || index === 12)
    throw new Error('Invalid bingo square index.');
};

const score = (squares: string[], overrides: BingoBoard['overrides'], spoken: boolean[]) => {
  const marked = squares.map((_, i) => i === 12 || (overrides[i] ?? spoken[i]!));
  return { squares, overrides, spoken, marked, winningLines: winningLines(marked) };
};

/** No board exists before the opening deal. A spoken fact survives a manual unmark. */
const evolveGame = (state: BingoState | undefined, event: KatakitEvent<BingoChange>) => {
  if (event.type === 'gameStarted') {
    if (state || event.meta.seq !== 0 || event.cards.length !== 1)
      throw new Error('A bingo runtime starts with exactly one card.');
    const [squares] = event.cards;
    validateSquares(squares);
    return score(
      [...squares],
      {},
      squares.map(() => false)
    );
  }
  if (!state) throw new Error('Missing opening bingo card.');
  validateIndex(event.index);
  if (event.type === 'squareSpoken')
    return score(
      state.squares,
      state.overrides,
      state.spoken.map((heard, i) => heard || i === event.index)
    );
  if (typeof event.marked !== 'boolean') throw new Error('Invalid bingo mark.');
  return score(state.squares, { ...state.overrides, [event.index]: event.marked }, state.spoken);
};

export const BingoPlugin = makeKatakitPlugin({
  type: 'Bingo',
  configure: (_options: {}) => ({}),
  observables: ({ getObservables }) => ({
    state$: optionalProperty(
      getObservables(EventLogPlugin).events$.pipe(
        filter(
          (e): e is KatakitEvent<BingoChange> =>
            e.type === 'gameStarted' ||
            e.type === 'squareManuallyChanged' ||
            e.type === 'squareSpoken'
        ),
        evolve(evolveGame, undefined),
        shareReplay({ bufferSize: 1, refCount: true })
      )
    ),
  }),
  methods: ({ getMethods, getObservables, observables: { state$ } }) => {
    const { emitEvent } = getMethods(EventLogPlugin);
    const emit = (event: BingoChange) => emitEvent(event);
    return {
      startGame: (squares: string[]) => {
        validateSquares(squares);
        if (getObservables(EventLogPlugin).eventCount$.get() !== 0)
          throw new Error('Start a new runtime for a new game.');
        emit({ type: 'gameStarted', cards: [[...squares]] });
      },
      changeSquare: (index: number, marked: boolean) => {
        validateIndex(index);
        if (typeof marked !== 'boolean') throw new Error('Invalid bingo mark.');
        const state = state$.get();
        if (!state) throw new Error('Missing opening bingo card.');
        if (state.overrides[index] !== marked)
          emit({ type: 'squareManuallyChanged', index, marked });
      },
      /** Live recognition records each matched square once; replay only consumes its index. */
      hearTurn: (text: string) => {
        const state = state$.get();
        if (!state) throw new Error('Missing opening bingo card.');
        state.squares.forEach((phrase, index) => {
          if (index !== 12 && !state.spoken[index] && matchPhrase(phrase, text))
            emit({ type: 'squareSpoken', index });
        });
      },
    };
  },
});
