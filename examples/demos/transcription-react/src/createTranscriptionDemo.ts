import { EventLogPlugin, makeKatakit, property, type KatakitEvent } from '@katakit/core';
import {
  makeTranscriptIngestionPlugin,
  parseTranscriptRecordedEvent,
  type TranscriptRecordedEvent,
} from '@katakit/transcript-ingestion';
import { combineLatest, map, shareReplay } from 'rxjs';

/** Own an in-memory log and input lifetime. Restoring history never starts capture or timers. */
export const createTranscriptionDemo = ({
  initialEvents = [],
}: { initialEvents?: readonly unknown[] } = {}) => {
  // Storage is a host choice. Validate every restored record before exposing a runtime.
  const history = initialEvents.map((value, seq): KatakitEvent<TranscriptRecordedEvent> => {
    const event = parseTranscriptRecordedEvent(value);
    const meta = (value as { meta?: unknown }).meta;
    if (meta !== undefined) {
      if (
        !meta ||
        typeof meta !== 'object' ||
        !('seq' in meta) ||
        !Number.isSafeInteger(meta.seq) ||
        Number(meta.seq) < 0 ||
        !('timestamp' in meta) ||
        !(meta.timestamp instanceof Date) ||
        !Number.isFinite(meta.timestamp.getTime())
      ) {
        throw new Error('Invalid transcript event metadata');
      }
      return { ...event, meta: { seq: Number(meta.seq), timestamp: meta.timestamp } };
    }
    // Pre-core snapshots had no log metadata. Import them deterministically, never
    // replacing source IDs or audio timestamps with wall-clock values.
    return { ...event, meta: { seq, timestamp: new Date(0) } };
  });
  const logKit = makeKatakit({ plugins: [], existingEvents: history }).start();
  const events$ = logKit.getObservables(EventLogPlugin).events$;
  const transcript = makeTranscriptIngestionPlugin<KatakitEvent, TranscriptRecordedEvent>({
    turnSilenceMs: 1400,
    eventLog: {
      events$,
      emitEvent: event =>
        logKit.getMethods(EventLogPlugin).emitEvent(parseTranscriptRecordedEvent(event)),
      toEvent: event => event,
      fromEvent: event => parseTranscriptRecordedEvent(event),
    },
  });
  const kit = makeKatakit({ plugins: [transcript.configure({})] });
  const methods = kit.start().getMethods(transcript);
  const observables = kit.getObservables(transcript);
  const state = property(
    combineLatest([observables.state$, observables.provisional$]).pipe(
      map(([content, provisional]) => ({
        completedTurns: content.conversationTurns,
        currentTurn: content.currentTurn,
        provisional,
      })),
      shareReplay({ bufferSize: 1, refCount: true })
    )
  );
  // Preserve existing gallery getValue consumers without exposing a writable subject.
  const state$ = Object.assign(state, { getValue: state.get });
  return {
    ...methods,
    state$,
    events$,
    getHistory: () => events$.getAll(),
  };
};
