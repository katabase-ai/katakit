import { EventLogPlugin, evolve, makeEffect, makeKatakitPlugin } from '@katakit/core';
import { filter, map, startWith } from 'rxjs';
import { BingoEvent, GameStartedBingoEvent, SquareSpokenBingoEvent } from './events';
import { property } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';

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

export const getWinningLanes = (marked: Record<number, boolean>) => {
  const lines: number[][] = [];
  for (let row = 0; row < 5; row++)
    lines.push(Array.from({ length: 5 }, (_, col) => row * 5 + col));
  for (let col = 0; col < 5; col++)
    lines.push(Array.from({ length: 5 }, (_, row) => row * 5 + col));
  lines.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return lines.filter(line => line.every(index => marked[index]));
};

export const BingoPlugin = makeKatakitPlugin({
  type: 'Bingo',
  configure: (options: {
    TranscriptIngestionPlugin: ReturnType<typeof makeTranscriptIngestionPlugin>;
  }) => options,
  observables: ({ getObservables }) => {
    const marked$ = property(
      getObservables(EventLogPlugin).events$.pipe(
        filter(
          (e): e is BingoEvent =>
            e.type === 'gameStarted' ||
            e.type === 'squareManuallyChanged' ||
            e.type === 'squareSpoken'
        ),
        evolve(
          (acc, event) => {
            if (event.type === 'gameStarted') {
              return Object.fromEntries(Array.from({ length: 25 }, (_, i) => [i, false])) as Record<
                number,
                boolean
              >;
            }
            if (acc === null) {
              throw new Error('Missing opening bingo event.');
            }
            if (event.type === 'squareSpoken') {
              return {
                ...acc,
                [event.index]: true,
              };
            }
            if (event.type === 'squareManuallyChanged') {
              return {
                ...acc,
                [event.index]: event.marked,
              };
            }
            return acc;
          },
          null as Record<number, boolean> | null
        ),
        startWith(null)
      )
    );
    const winningLanes$ = property(
      marked$.pipe(
        map(marked => (marked ? getWinningLanes(marked) : [])),
        startWith([])
      )
    );
    return {
      squares$: property(
        getObservables(EventLogPlugin).events$.pipe(
          filter((e): e is GameStartedBingoEvent => e.type === 'gameStarted'),
          map(e => e.squares),
          startWith(null)
        )
      ),
      marked$,
      winningLanes$,
    };
  },
  methods: ({ getMethods, getObservables, observables: { marked$ } }) => {
    const { emitEvent } = getMethods(EventLogPlugin);
    return {
      startGame: (squares: string[]) => {
        if (getObservables(EventLogPlugin).eventCount$.get() !== 0)
          throw new Error('Start a new runtime for a new game.');
        emitEvent({ type: 'gameStarted', squares: [...squares] });
      },
      changeSquare: (index: number, marked: boolean) => {
        const current = marked$.get();
        if (!current) throw new Error('Missing opening bingo card.');
        if (current[index] !== marked) emitEvent({ type: 'squareManuallyChanged', index, marked });
      },
      /** Live recognition records each matched square once; replay only consumes its index. */
      // hearTurn: (text: string) => {
      //   const state = state$.get();
      //   if (!state) throw new Error("Missing opening bingo card.");
      // state.squares.forEach((phrase, index) => {
      //   if (index !== 12 && !state.spoken[index] && matchPhrase(phrase, text))
      //     emit({ type: "squareSpoken", index });
      // });
      // },
    };
  },
  effects: ({ options, getObservables, getMethods, observables: { squares$, marked$ } }) => [
    makeEffect({
      on: getObservables(options.TranscriptIngestionPlugin).conversationTurns$,
      handler: conversationTurn => {
        const squares = squares$.get();
        const marked = marked$.get();
        if (!squares || !marked) return;

        for (const [index, square] of squares.entries()) {
          if (marked[index]) return;

          if (matchPhrase(square, conversationTurn.text)) {
            getMethods(EventLogPlugin).emitEvent({ type: 'squareSpoken', index } satisfies Omit<
              SquareSpokenBingoEvent,
              'meta'
            >);
          }
        }
      },
      backpressure: 'latest',
    }),
  ],
});
