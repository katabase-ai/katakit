import { createTranscriptInput } from './transcriptInput';
import { property } from '@katakit/core';
import { bind } from '@react-rxjs/core';
import { combineLatest, map, shareReplay, Subject, takeUntil } from 'rxjs';

/** One visit owns a log and live input; restoring it never starts recognition or a turn timer. */
export const createTranscriptionDemo = ({
  initialEvents = [],
}: { initialEvents?: readonly unknown[] } = {}) => {
  const input = createTranscriptInput(initialEvents);
  const { collectedConversationTurns$, pendingConversationTurn$, provisionalUtterance$ } =
    input.views;
  const closed = new Subject<void>();
  const state$ = property(
    combineLatest([
      collectedConversationTurns$,
      pendingConversationTurn$,
      provisionalUtterance$,
    ]).pipe(
      map(([completedTurns, currentTurn, provisional]) => ({
        completedTurns,
        currentTurn,
        provisional: provisional?.text,
      })),
      takeUntil(closed),
      shareReplay({ bufferSize: 1, refCount: true })
    )
  );
  // Bind once, outside rendering. Subscribe boundaries own only their UI subscriptions.
  const [useTranscript, transcript$] = bind(state$);
  return {
    ingestSegment: input.ingestSegment,
    updateProvisional: input.updateProvisional,
    flush: input.flush,
    state$,
    events$: input.events$,
    useTranscript,
    transcript$,
    close: () => {
      input.close();
      closed.next();
      closed.complete();
    },
  };
};
