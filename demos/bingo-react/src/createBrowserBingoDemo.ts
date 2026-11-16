import { makeKatakit } from '@katakit/core';
import { makeBingoPlugin } from './bingo';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import { BehaviorSubject, combineLatest } from 'rxjs';

/** A local subscription owns the transcript/card bridge; no asynchronous core effect is started. */
export const createBrowserBingoDemo = () => {
  const transcript = makeTranscriptIngestionPlugin();
  const bingo = makeBingoPlugin();
  const kit = makeKatakit({ plugins: [transcript.configure({}), bingo.configure({})] });
  const running = kit.start();
  const methods = running.getMethods(transcript);
  const bingoMethods = running.getMethods(bingo);
  const { conversationTurns$, currentTurn$, lastHeard$ } = kit.getObservables(transcript);
  const board$ = kit.getObservables(bingo).state$;
  const bridge = combineLatest([conversationTurns$, currentTurn$]).subscribe(([turns, current]) => {
    bingoMethods.setTurns(current ? [...turns, current] : turns);
  });
  const state$ = new BehaviorSubject({ board: board$.get(), lastHeard: lastHeard$.get() });
  const subscription = combineLatest([board$, lastHeard$]).subscribe(([board, lastHeard]) =>
    state$.next({ board, lastHeard })
  );
  return {
    ...methods,
    bingoMethods,
    state$,
    close: () => {
      methods.close();
      bridge.unsubscribe();
      bingoMethods.close();
      subscription.unsubscribe();
      state$.complete();
    },
  };
};
