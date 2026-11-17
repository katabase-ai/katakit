import { makeKatakit, property } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import { combineLatest, map, shareReplay, Subject, takeUntil } from 'rxjs';
import { NotesEventSchema, type NotesEvent } from './notesEvents';
import { makeNotesPlugin } from './notesPlugin';

/** Replaying a visit restores its content; only an explicit connection can start new model work. */
export const createNotesDemo = ({ initialEvents = [] }: { initialEvents?: NotesEvent[] } = {}) => {
  const eventLog = makeEventLogPlugin({ validateEvent: NotesEventSchema });
  const transcript = makeTranscriptIngestionPlugin({
    forward: {
      createEvent: event =>
        event.type === 'turn' ? { type: 'transcriptTurn' as const, turn: event.turn } : undefined,
      emitEvent: event => kit.getMethods(eventLog).emitEvent(event),
    },
  });
  const notesPlugin = makeNotesPlugin({ EventLogPlugin: eventLog });
  const kit = makeKatakit({
    plugins: [
      eventLog.configure({ initialEvents }),
      transcript.configure({}),
      notesPlugin.configure({}),
    ],
  }).start();
  const input = kit.getMethods(transcript);
  const notes = kit.getMethods(notesPlugin);
  const { currentTurn$, provisional$, events$: transcriptEvents$ } = kit.getObservables(transcript);
  const { state$: notesState$, markdown$ } = kit.getObservables(notesPlugin);
  const closed = new Subject<void>();
  const state$ = property(
    combineLatest([currentTurn$, provisional$, notesState$, markdown$]).pipe(
      map(([current, provisional, notes, markdown]) => ({
        turns: notes.turns,
        current,
        provisional,
        notes,
        markdown,
      })),
      takeUntil(closed),
      shareReplay({ bufferSize: 1, refCount: true })
    )
  );
  return {
    ingestSegment: input.ingestSegment,
    updateProvisional: input.updateProvisional,
    flush: input.flush,
    notes,
    state$,
    transcriptEvents$,
    events$: kit.getObservables(eventLog).events$,
    close: () => {
      notes.close();
      input.close();
      closed.next();
      closed.complete();
    },
  };
};
