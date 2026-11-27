import { createTranscriptInput } from './transcriptInput';
import { property } from '@katakit/core';
import type { TranscriptIngestionEvent } from '@katakit/transcript-ingestion';
import { bind } from '@react-rxjs/core';
import { combineLatest, map, shareReplay, Subject, takeUntil } from 'rxjs';

/**
 * Create one transcript session for the standalone page or a gallery visit.
 * The input adapter owns ingestion's event log and turn timer. This factory combines its
 * completed, pending, and provisional projections into state$ and binds that view for React.
 * Callers feed recognition callbacks through the returned methods and stop/drain capture
 * before flushing and closing the session. Restoring typed history starts neither capture
 * nor a turn timer.
 */
export const createTranscriptionDemo = ({
  initialEvents = [],
}: { initialEvents?: readonly TranscriptIngestionEvent[] } = {}) => {
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
