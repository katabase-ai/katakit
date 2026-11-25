import { createTranscriptInput } from './transcriptInput';
import { BehaviorSubject, combineLatest } from 'rxjs';

/** Own the input plugin, projections, and transcript timer without starting background effects. */
export const createTranscriptionDemo = () => {
  const input = createTranscriptInput();
  const { collectedConversationTurns$, pendingConversationTurn$, provisionalUtterance$ } =
    input.views;
  const state$ = new BehaviorSubject({
    completedTurns: collectedConversationTurns$.get(),
    currentTurn: pendingConversationTurn$.get(),
    provisional: provisionalUtterance$.get()?.text,
  });
  const subscription = combineLatest([
    collectedConversationTurns$,
    pendingConversationTurn$,
    provisionalUtterance$,
  ]).subscribe(([completedTurns, currentTurn, provisional]) =>
    state$.next({ completedTurns, currentTurn, provisional: provisional?.text })
  );
  return {
    ingestSegment: input.ingestSegment,
    updateProvisional: input.updateProvisional,
    flush: input.flush,
    state$,
    close: () => {
      input.close();
      subscription.unsubscribe();
      state$.complete();
    },
  };
};
