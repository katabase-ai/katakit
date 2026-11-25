import { EventLogPlugin, makeKatakit, type KatakitEvent } from '@katakit/core';
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
