import { makeKatakit, property } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import { combineLatest, map, shareReplay, Subject, takeUntil } from 'rxjs';
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
  const eventLog = makeEventLogPlugin({ validateEvent: NotesEventSchema });
  const logKit = makeKatakit({ plugins: [eventLog.configure({ initialEvents: history })] }).start();
  const { events$ } = logKit.getObservables(eventLog);
  const { emitEvent } = logKit.getMethods(eventLog);
  const transcript = makeTranscriptIngestionPlugin({
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
    events$: transcriptEvents$,
  } = kit.getObservables(transcript);
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
