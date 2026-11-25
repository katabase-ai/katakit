import { EventLogPlugin, makeKatakit, property, type KatakitEvent } from '@katakit/core';
import { makeTranscriptIngestionPlugin, type TranscriptEvent } from '@katakit/transcript-ingestion';
import { BehaviorSubject, filter, Subject, switchMap, takeUntil } from 'rxjs';
import {
  BingoPlugin,
  defaultSquares,
  validateBoard,
  type BingoBoard,
  type BingoState,
} from './bingo/plugin';
import { isSegment, restoreSegments } from './history';

type RecordedEvent = Exclude<TranscriptEvent, { type: 'provisional' }>;
const isRecordedEvent = (value: unknown): value is RecordedEvent => {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  return (
    event.type === 'reset' ||
    (event.type === 'segment' && isSegment(event.segment)) ||
    (event.type === 'turn' && isSegment(event.turn))
  );
};

/** Each panel mount owns its log, projections, and ingestion silence timer. */
export const createPanelRuntime = (
  segments: unknown = [],
  board?: unknown,
  recordedHistory?: unknown[]
) => {
  const initialEvents: RecordedEvent[] =
    recordedHistory === undefined
      ? restoreSegments(segments).map(segment => ({ type: 'segment', segment }))
      : recordedHistory.map(event => {
          if (!isRecordedEvent(event)) throw new Error('Invalid restored transcript record');
          return event;
        });
  const existingEvents = initialEvents.map((event, seq): KatakitEvent<RecordedEvent> => {
    const meta = (event as { meta?: unknown }).meta;
    if (meta === undefined) {
      // Legacy segment snapshots have no log metadata. Epoch metadata is purely
      // an import marker; source IDs and audio timestamps remain untouched.
      return { ...event, meta: { seq, timestamp: new Date(0) } };
    }
    if (
      !meta ||
      typeof meta !== 'object' ||
      !('seq' in meta) ||
      meta.seq !== seq ||
      !('timestamp' in meta) ||
      !(meta.timestamp instanceof Date) ||
      !Number.isFinite(meta.timestamp.getTime())
    )
      throw new Error('Invalid restored transcript metadata');
    return { ...event, meta: { seq, timestamp: meta.timestamp } };
  });
  const logKit = makeKatakit({ plugins: [], existingEvents });
  const logRunning = logKit.start();
  const { events$ } = logKit.getObservables(EventLogPlugin);
  const { emitEvent } = logRunning.getMethods(EventLogPlugin);
  const transcript = makeTranscriptIngestionPlugin<KatakitEvent, RecordedEvent>({
    eventLog: {
      events$,
      emitEvent: event => {
        // Core's emitter deliberately accepts any event; validation belongs to this host.
        if (!isRecordedEvent(event)) throw new Error('Invalid transcript record');
        emitEvent(event);
      },
      toEvent: event => event,
      fromEvent: event => {
        if (!isRecordedEvent(event)) throw new Error('Invalid transcript record');
        return event;
      },
    },
  });
  const kit = makeKatakit({ plugins: [transcript.configure({})] });
  const running = kit.start();
  const input = running.getMethods(transcript);
  const transcriptState = kit.getObservables(transcript);
  let initialBoard: BingoBoard = { squares: [...defaultSquares], overrides: {} };
  let restoredBoard = false;
  if (board !== undefined) {
    try {
      validateBoard(board as BingoBoard);
      initialBoard = board as BingoBoard;
      restoredBoard = true;
    } catch {
      // Old or damaged storage leaves the default board playable.
    }
  }
  const createBoard = (value: BingoBoard) => {
    validateBoard(value);
    const boardKit = makeKatakit({ plugins: [BingoPlugin.configure({})] }).start();
    const commands = boardKit.getMethods(BingoPlugin);
    commands.startGame(value.squares);
    for (const [index, marked] of Object.entries(value.overrides))
      commands.changeSquare(Number(index), marked);
    return { commands, state$: boardKit.getObservables(BingoPlugin).state$ };
  };
  // Only the current runtime handle is mutable; its core log owns all board content.
  const boards = new BehaviorSubject(createBoard(initialBoard));
  const stopped = new Subject<void>();
  const board$ = property(
    boards.pipe(
      switchMap(value => value.state$),
      filter((value): value is BingoState => value !== undefined),
      takeUntil(stopped)
    )
  );
  const projection = transcriptState.state$.subscribe(state => {
    for (const turn of state.conversationTurns) boards.value.commands.hearTurn(turn.text);
    if (state.currentTurn) boards.value.commands.hearTurn(state.currentTurn.text);
  });
  let closed = false;
  const reset = (value: BingoBoard) => {
    if (closed) return;
    validateBoard(value);
    input.flush();
    boards.next(createBoard(value));
    input.reset();
  };
  const methods = {
    ...input,
    reset: () => {
      const { squares, overrides } = board$.get();
      reset({ squares, overrides });
    },
  };
  const bingoMethods = {
    setSquares: (squares: string[]) => reset({ squares, overrides: {} }),
    setOverride: (index: number, marked: boolean) => {
      if (!closed) boards.value.commands.changeSquare(index, marked);
    },
  };
  return {
    methods,
    bingoMethods,
    restoredBoard,
    events$,
    transcript: transcriptState,
    board$,
    close: () => {
      if (closed) return;
      closed = true;
      try {
        methods.close();
      } finally {
        projection.unsubscribe();
        stopped.next();
        stopped.complete();
        boards.complete();
      }
    },
  };
};

export type PanelRuntime = ReturnType<typeof createPanelRuntime>;
