import {
  EventLogPlugin,
  makeKatakit,
  property,
  type KatakitEvent,
  type WithEager,
} from '@katakit/core';
import * as v from 'valibot';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import { combineLatest, filter, map, shareReplay, Subject, takeUntil, type Observable } from 'rxjs';
import {
  NotesEventSchema,
  notesTranscriptEvent,
  parseNotesHistory,
  type NotesEvent,
} from './notesEvents';
import { makeNotesPlugin } from './notesPlugin';

/** Replaying a visit restores its content; only an explicit connection can start new model work. */
export const createNotesDemo = ({ initialEvents = [] }: { initialEvents?: unknown } = {}) => {
  const history = parseNotesHistory(initialEvents);
  const logKit = makeKatakit({ plugins: [], existingEvents: history }).start();
  // This private runtime only receives validated notes events.
  const events$ = logKit.getObservables(EventLogPlugin).events$ as WithEager<
    Observable<KatakitEvent<NotesEvent>>
  >;
  const emitEvent = (event: NotesEvent) =>
    logKit.getMethods(EventLogPlugin).emitEvent(v.parse(NotesEventSchema, event));
  const transcript = makeTranscriptIngestionPlugin<KatakitEvent<NotesEvent>, NotesEvent>({
    eventLog: {
      events$,
      emitEvent,
      toEvent: (event): NotesEvent => {
        switch (event.type) {
          case 'segment':
            return { type: 'transcriptSegment', segment: event.segment };
          case 'turn':
            return { type: 'transcriptTurn', turn: event.turn };
          case 'reset':
            return { type: 'transcriptReset' };
        }
      },
      fromEvent: notesTranscriptEvent,
    },
  });
  const notesPlugin = makeNotesPlugin({ eventLog: { events$, emitEvent } });
  const kit = makeKatakit({
    plugins: [transcript.configure({}), notesPlugin.configure({})],
  }).start();
  const input = kit.getMethods(transcript);
  const notes = kit.getMethods(notesPlugin);
  const {
    conversationTurns$,
    segments$,
    currentTurn$,
    provisional$,
    events$: ingestionEvents$,
  } = kit.getObservables(transcript);
  // Preview notifications remain live-only; content views read the mapped history above.
  const transcriptEvents$ = ingestionEvents$.pipe(
    filter(event => event.type === 'provisional' || event.type === 'segment'),
    map(event =>
      event.type === 'segment'
        ? { type: 'final' as const, text: event.segment.text }
        : { type: 'provisional' as const, text: event.text ?? '' }
    )
  );
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
    transcript: { conversationTurns$, segments$, currentTurn$, provisional$ },
    events$,
    close: () => {
      notes.close();
      input.close();
      closed.next();
      closed.complete();
    },
  };
};
