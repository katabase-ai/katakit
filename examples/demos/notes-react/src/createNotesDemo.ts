import { EventLogPlugin, makeKatakit, property, skipReplay } from '@katakit/core';
import { combineLatest, map, merge, shareReplay, Subject, takeUntil } from 'rxjs';
import { readNotesEvent } from './notesEvents';
import { createTranscriptInput } from './transcriptInput';
import { makeNotesPlugin } from './notesPlugin';

/** Replaying a visit restores its content; only an explicit connection can start new model work. */
export const createNotesDemo = ({ initialEvents = [] }: { initialEvents?: unknown[] } = {}) => {
  const notesPlugin = makeNotesPlugin();
  const kit = makeKatakit({
    existingEvents: initialEvents.map(readNotesEvent),
    plugins: [notesPlugin.configure({})],
  }).start();
  const input = createTranscriptInput();
  const notes = kit.getMethods(notesPlugin);
  const turns = input.turns$.subscribe(notes.recordTurn);
  const { currentTurn$, provisional$ } = input;
  const transcriptEvents$ = merge(
    input.views.provisionalUtterances$.pipe(
      map(({ text }) => ({ type: 'provisional' as const, text }))
    ),
    input.views.utterances$.pipe(map(({ text }) => ({ type: 'final' as const, text })))
  ).pipe(skipReplay());
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
    transcript: {
      conversationTurns$: notesState$.pipe(map(state => state.turns)),
      currentTurn$,
      provisional$,
    },
    events$: kit.getObservables(EventLogPlugin).events$,
    close: () => {
      notes.close();
      turns.unsubscribe();
      input.close();
      closed.next();
      closed.complete();
    },
  };
};
