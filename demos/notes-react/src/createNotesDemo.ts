import { makeKatakit } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { makeNotesPlugin } from './notesPlugin';

/** One visit owns its transcript and model work; the host owns capture and recognition. */
export const createNotesDemo = () => {
  const transcript = makeTranscriptIngestionPlugin();
  const notesPlugin = makeNotesPlugin({ TranscriptIngestionPlugin: transcript });
  const kit = makeKatakit({
    plugins: [transcript.configure({}), notesPlugin.configure({})],
  }).start();
  const methods = kit.getMethods(transcript);
  const notes = kit.getMethods(notesPlugin);
  const { conversationTurns$, currentTurn$, provisional$ } = kit.getObservables(transcript);
  const notesState$ = kit.getObservables(notesPlugin).state$;
  const state$ = new BehaviorSubject({
    turns: conversationTurns$.get(),
    current: currentTurn$.get(),
    provisional: provisional$.get(),
    notes: notesState$.get(),
  });
  const subscription = combineLatest([
    conversationTurns$,
    currentTurn$,
    provisional$,
    notesState$,
  ]).subscribe(([turns, current, provisional, notes]) =>
    state$.next({ turns, current, provisional, notes })
  );
  return {
    ingestSegment: methods.ingestSegment,
    updateProvisional: methods.updateProvisional,
    flush: methods.flush,
    notes,
    state$,
    close: () => {
      notes.close();
      methods.close();
      subscription.unsubscribe();
      state$.complete();
    },
  };
};
