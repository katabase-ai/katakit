import { EventLogPlugin, makeKatakit, property } from '@katakit/core';
import {
  makeTranscriptIngestionPlugin,
  type TranscriptSegment,
} from '@katakit/transcript-ingestion';
import { BehaviorSubject, combineLatest, EMPTY, filter, map, switchMap } from 'rxjs';
import { BingoPlugin, defaultSquares, validateBoard, type BingoBoard } from './plugin';

const turnSilenceMs = 1400;
const createRound = (board: BingoBoard) => {
  validateBoard(board);
  const ingestion = makeTranscriptIngestionPlugin({ turnSilenceMs });
  const kit = makeKatakit({
    plugins: [BingoPlugin.configure({}), ingestion.configure({})],
  }).start();
  const bingo = kit.getMethods(BingoPlugin);
  bingo.startGame(board.squares);
  for (const [index, marked] of Object.entries(board.overrides))
    bingo.changeSquare(Number(index), marked);
  const input = kit.getMethods(ingestion);
  const transcript = kit.getObservables(ingestion);
  return {
    history: kit.getObservables(EventLogPlugin).events$,
    board$: kit.getObservables(BingoPlugin).state$.pipe(filter(state => state !== undefined)),
    transcript,
    bingo,
    ingestSegment: (segment: TranscriptSegment) => {
      // Ingestion owns identity, source/speaker boundaries and optional audio timing.
      input.ingestSegment(segment);
      const pending = transcript.state$.get().currentTurn;
      if (pending) bingo.hearTurn(pending.text);
    },
    updateProvisional: (text: string) =>
      input.updateProvisionalUtterance({ text, speaker: 'input' }),
    flush: () => {
      input.flush();
      if (transcript.provisionalUtterance$.get()?.text)
        input.updateProvisionalUtterance({ text: '', speaker: 'input' });
    },
    close: input.close,
  };
};

/** A capture sink outlives a round. Only the runtime handle is switched; its log owns the board. */
export const createBingoSession = () => {
  const rounds = new BehaviorSubject<ReturnType<typeof createRound> | undefined>(
    createRound({ squares: defaultSquares, overrides: {} })
  );
  const board$ = property(rounds.pipe(switchMap(round => round?.board$ ?? EMPTY)));
  const transcript$ = property(
    rounds.pipe(
      switchMap(round =>
        round
          ? combineLatest([round.transcript.state$, round.transcript.provisionalUtterance$]).pipe(
              map(([state, provisional]) => ({
                completed: state.conversationTurns,
                pending: state.currentTurn ?? null,
                provisional: provisional?.text,
              }))
            )
          : EMPTY
      )
    )
  );
  return {
    board$,
    transcript$,
    get history() {
      return rounds.value!.history;
    },
    restart: (squares: string[], overrides: BingoBoard['overrides'] = {}) => {
      if (!rounds.value) return;
      const next = createRound({ squares, overrides });
      rounds.value.close();
      rounds.next(next);
    },
    changeSquare: (index: number, marked: boolean) =>
      rounds.value?.bingo.changeSquare(index, marked),
    ingestSegment: (segment: TranscriptSegment) => rounds.value?.ingestSegment(segment),
    updateProvisional: (text: string) => rounds.value?.updateProvisional(text),
    flush: () => rounds.value?.flush(),
    close: () => {
      rounds.value?.close();
      rounds.next(undefined);
      rounds.complete();
    },
  };
};
