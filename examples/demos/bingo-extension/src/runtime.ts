import { makeKatakit } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import { makeTranscriptIngestionPlugin, type TranscriptEvent } from '@katakit/transcript-ingestion';
import { makeBingoPlugin, type BingoBoard } from './bingo';
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
  const log = makeEventLogPlugin<RecordedEvent>({
    validateEvent: {
      '~standard': {
        version: 1,
        vendor: 'bingo-extension',
        validate: value =>
          isRecordedEvent(value)
            ? { value }
            : { issues: [{ message: 'Invalid transcript record' }] },
      },
    },
  });
  const logKit = makeKatakit({
    plugins: [
      log.configure({
        initialEvents,
      }),
    ],
  });
  const logRunning = logKit.start();
  const { events$ } = logKit.getObservables(log);
  const { emitEvent } = logRunning.getMethods(log);
  const transcript = makeTranscriptIngestionPlugin<RecordedEvent>({
    eventLog: { events$, emitEvent, toEvent: event => event, fromEvent: event => event },
  });
  const bingo = makeBingoPlugin({ TranscriptIngestionPlugin: transcript });
  const kit = makeKatakit({ plugins: [transcript.configure({}), bingo.configure({})] });
  const running = kit.start();
  const methods = running.getMethods(transcript);
  const bingoMethods = running.getMethods(bingo);
  let restoredBoard = false;
  if (board !== undefined) {
    try {
      bingoMethods.restoreBoard(board as BingoBoard);
      restoredBoard = true;
    } catch {
      // Old or damaged storage leaves the default board playable.
    }
  }
  let closed = false;
  return {
    methods,
    bingoMethods,
    restoredBoard,
    events$,
    transcript: kit.getObservables(transcript),
    board$: kit.getObservables(bingo).state$,
    close: () => {
      if (closed) return;
      closed = true;
      methods.close();
      bingoMethods.close();
    },
  };
};

export type PanelRuntime = ReturnType<typeof createPanelRuntime>;
