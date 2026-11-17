import { makeKatakit } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import { BehaviorSubject, combineLatest } from 'rxjs';

/** Own the input plugin, projections, and transcript timer without starting background effects. */
export const createTranscriptionDemo = () => {
  const transcript = makeTranscriptIngestionPlugin({ turnSilenceMs: 1400 });
  const kit = makeKatakit({ plugins: [transcript.configure({})] });
  const methods = kit.start().getMethods(transcript);
  const { conversationTurns$, currentTurn$, provisional$ } = kit.getObservables(transcript);
  const state$ = new BehaviorSubject({
    completedTurns: conversationTurns$.get(),
    currentTurn: currentTurn$.get(),
    provisional: provisional$.get(),
  });
  const subscription = combineLatest([conversationTurns$, currentTurn$, provisional$]).subscribe(
    ([completedTurns, currentTurn, provisional]) =>
      state$.next({ completedTurns, currentTurn, provisional })
  );
  return {
    ...methods,
    state$,
    close: () => {
      methods.close();
      subscription.unsubscribe();
      state$.complete();
    },
  };
};
