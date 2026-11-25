import { EventLogPlugin, makeKatakit, property } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import type { TranscriptionSegment } from '@katakit/transcription';
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
  const seen = new Set<string>();
  let previous: TranscriptionSegment | undefined;
  return {
    history: kit.getObservables(EventLogPlugin).events$,
    board$: kit.getObservables(BingoPlugin).state$.pipe(filter(state => state !== undefined)),
    transcript,
    bingo,
    ingestSegment: (segment: TranscriptionSegment) => {
      const id = JSON.stringify([segment.sourceId, segment.id]);
      const text = segment.text.trim();
      if (!text || seen.has(id)) return;
      seen.add(id);
      if (
        previous &&
        (previous.sourceId !== segment.sourceId ||
          (segment.startMs !== undefined &&
            previous.endMs !== undefined &&
            segment.startMs - previous.endMs > turnSilenceMs))
      )
        input.flush();
      previous = segment;
      // Untimed sink inputs still carry text; zero is the demo's unknown audio offset.
      input.ingestUtterance({
        id,
        text,
        speaker: segment.sourceId,
        startMs: segment.startMs ?? 0,
        endMs: segment.endMs ?? segment.startMs ?? 0,
      });
      bingo.hearTurn(transcript.pendingConversationTurn$.get()!.text);
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
          ? combineLatest([
              round.transcript.collectedConversationTurns$,
              round.transcript.pendingConversationTurn$,
              round.transcript.provisionalUtterance$,
            ]).pipe(
              map(([completed, pending, provisional]) => ({
                completed,
                pending,
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
    ingestSegment: (segment: TranscriptionSegment) => rounds.value?.ingestSegment(segment),
    updateProvisional: (text: string) => rounds.value?.updateProvisional(text),
    flush: () => rounds.value?.flush(),
    close: () => {
      rounds.value?.close();
      rounds.next(undefined);
      rounds.complete();
    },
  };
};
