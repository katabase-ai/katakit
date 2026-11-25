import { EventLogPlugin, makeKatakitPlugin, property } from '@katakit/core';
import type { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import {
  ReplaySubject,
  combineLatest,
  filter,
  map,
  of,
  scan,
  shareReplay,
  startWith,
  takeUntil,
  type Observable,
} from 'rxjs';

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
      key !== String(index) ||
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

/** Board history is independent of the input session; shuffle records its actual draw. */
export type BingoEvent =
  | { type: 'board-set'; board: BingoBoard }
  | { type: 'override-set'; index: number; value: boolean | null }
  | { type: 'turns-set'; turns: BingoTurn[] };

/** Validate and copy untrusted history before passing it to an event log. */
export const parseBingoEvent = (input: unknown): BingoEvent => {
  if (!input || typeof input !== 'object') throw new Error('Invalid bingo event.');
  const event = input as BingoEvent;
  if (event.type === 'board-set') {
    if (
      !Array.isArray(event.board?.squares) ||
      !event.board.overrides ||
      typeof event.board.overrides !== 'object' ||
      Array.isArray(event.board.overrides) ||
      event.board.squares.some(value => typeof value !== 'string')
    )
      throw new Error('Invalid bingo board.');
    validateSquares(event.board.squares);
    validateOverrides(event.board.overrides);
    return {
      type: event.type,
      board: { squares: [...event.board.squares], overrides: { ...event.board.overrides } },
    };
  }
  if (event.type === 'override-set') {
    if (
      !Number.isInteger(event.index) ||
      event.index < 0 ||
      event.index >= 25 ||
      event.index === 12
    )
      throw new Error('Invalid bingo square index.');
    if (event.value !== null && typeof event.value !== 'boolean')
      throw new Error('Invalid bingo square override.');
    return { type: event.type, index: event.index, value: event.value };
  }
  if (
    event.type === 'turns-set' &&
    Array.isArray(event.turns) &&
    event.turns.every(turn => turn && typeof turn.id === 'string' && typeof turn.text === 'string')
  ) {
    if (new Set(event.turns.map(turn => turn.id)).size !== event.turns.length)
      throw new Error('Duplicate bingo turn ID.');
    return { type: event.type, turns: event.turns.map(({ id, text }) => ({ id, text })) };
  }
  throw new Error('Invalid bingo event.');
};

export const bingoEventSchema = {
  '~standard': {
    version: 1 as const,
    vendor: 'bingo',
    validate: (input: unknown) => {
      try {
        return { value: parseBingoEvent(input) };
      } catch (error) {
        return { issues: [{ message: String(error) }] };
      }
    },
  },
};

type Content = { board: BingoBoard; turns: BingoTurn[] };
const initialContent = (): Content => ({
  board: { squares: [...defaultSquares], overrides: {} },
  turns: [],
});
const reduceContent = (content: Content, event: BingoEvent): Content => {
  if (event.type === 'board-set') return { ...content, board: event.board };
  if (event.type === 'turns-set') return { ...content, turns: event.turns };
  const overrides = { ...content.board.overrides };
  if (event.value === null) delete overrides[event.index];
  else overrides[event.index] = event.value;
  return { ...content, board: { ...content.board, overrides } };
};

/** Headless event-sourced card. Input, storage, and subscription lifetime belong to its host. */
export const makeBingoPlugin = ({
  TranscriptIngestionPlugin,
  eventLog,
}: {
  TranscriptIngestionPlugin?: ReturnType<typeof makeTranscriptIngestionPlugin>;
  /** A replaying, synchronously validated host log; filter host union events before binding. */
  eventLog?: { events$: Observable<BingoEvent>; emitEvent: (event: BingoEvent) => void };
} = {}) =>
  makeKatakitPlugin({
    type: 'Bingo',
    configure: (_options: {}) => ({ closed$: new ReplaySubject<void>(1), closed: false }),
    observables: ({ options, getObservables }) => {
      const events$ =
        eventLog?.events$ ??
        getObservables(EventLogPlugin).events$.pipe(
          filter(event => event.type === 'bingo'),
          map(event => parseBingoEvent(event.event))
        );
      const content$ = property(
        events$.pipe(
          scan(reduceContent, initialContent()),
          startWith(initialContent()),
          takeUntil(options.closed$),
          shareReplay({ bufferSize: 1, refCount: true })
        )
      );
      const turns$ = TranscriptIngestionPlugin
        ? getObservables(TranscriptIngestionPlugin).state$.pipe(
            map(state =>
              state.currentTurn
                ? [...state.conversationTurns, state.currentTurn]
                : state.conversationTurns
            )
          )
        : of(undefined);
      const state$ = property(
        combineLatest([content$, turns$]).pipe(
          map(([content, turns]) => calculate(content.board, turns ?? content.turns)),
          takeUntil(options.closed$),
          shareReplay({ bufferSize: 1, refCount: true })
        )
      );
      return { state$, content$, events$: events$.pipe(takeUntil(options.closed$)) };
    },
    methods: ({ options, observables, getMethods }) => {
      const append = (event: BingoEvent) => {
        if (options.closed) return;
        const validated = parseBingoEvent(event);
        if (eventLog) eventLog.emitEvent(validated);
        else getMethods(EventLogPlugin).emitEvent({ type: 'bingo', event: validated });
      };
      return {
        close: () => {
          if (options.closed) return;
          options.closed = true;
          options.closed$.next();
          options.closed$.complete();
        },
        /** Standalone input replacement/reset. A bound ingestion plugin owns input instead. */
        setTurns: (turns: BingoTurn[]) => {
          if (TranscriptIngestionPlugin)
            throw new Error('The transcript plugin owns this card input.');
          const previous = observables.content$.get().turns;
          if (
            turns.length === previous.length &&
            turns.every((turn, i) => turn.id === previous[i]?.id && turn.text === previous[i]?.text)
          )
            return;
          append({ type: 'turns-set', turns });
        },
        setSquares: (squares: string[]) =>
          append({ type: 'board-set', board: { squares, overrides: {} } }),
        /** Migrate a legacy persisted board with one validated event; never restores transcript. */
        restoreBoard: (board: BingoBoard) => append({ type: 'board-set', board }),
        setOverride: (index: number, value: boolean | undefined) =>
          append({ type: 'override-set', index, value: value ?? null }),
      };
    },
  });
