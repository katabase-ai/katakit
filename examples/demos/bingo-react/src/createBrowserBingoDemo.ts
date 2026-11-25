import { EventLogPlugin, makeKatakit, property, type KatakitEvent } from '@katakit/core';
import { makeBingoPlugin, type BingoEvent } from './bingo';
import {
  makeTranscriptIngestionPlugin,
  type TranscriptRecordedEvent,
} from '@katakit/transcript-ingestion';
import { Observable, map } from 'rxjs';
import { parseBrowserBingoEvent, restoreBrowserBingoHistory } from './history';

export type BrowserBingoEvent =
  | { type: 'bingo'; event: BingoEvent }
  | { type: 'transcript'; event: TranscriptRecordedEvent };

/** One in-memory host log; restoring it runs only deterministic content projections. */
export const createBrowserBingoDemo = ({
  initialEvents = [],
}: { initialEvents?: readonly unknown[] } = {}) => {
  const existingEvents = restoreBrowserBingoHistory(initialEvents);
  // Binding is subscribed only after kit exists; all plugins use that one runtime log.
  const events$: Observable<KatakitEvent> = new Observable<KatakitEvent>(subscriber =>
    kit.getObservables(EventLogPlugin).events$.subscribe(subscriber)
  );
  const transcript = makeTranscriptIngestionPlugin<KatakitEvent, BrowserBingoEvent>({
    eventLog: {
      events$,
      emitEvent: (event): void => {
        running.getMethods(EventLogPlugin).emitEvent(parseBrowserBingoEvent(event));
      },
      toEvent: event => ({ type: 'transcript', event }),
      fromEvent: event => {
        const parsed = parseBrowserBingoEvent(event);
        return parsed.type === 'transcript' ? parsed.event : undefined;
      },
    },
  });
  const bingo = makeBingoPlugin({
    TranscriptIngestionPlugin: transcript,
  });
  const kit = makeKatakit({
    existingEvents,
    plugins: [transcript.configure({}), bingo.configure({})],
  });
  const running = kit.start();
  const methods = running.getMethods(transcript);
  const bingoMethods = running.getMethods(bingo);
  const {
    conversationTurns$,
    currentTurn$,
    provisional$,
    events$: transcriptEvents$,
  } = kit.getObservables(transcript);
  const board$ = kit.getObservables(bingo).state$;
  const projected = property(board$.pipe(map(board => ({ board }))));
  // Preserve the gallery's synchronous snapshot interface without a writable state subject.
  const state$ = Object.assign(projected, { getValue: projected.get });
  return {
    ...methods,
    bingoMethods,
    state$,
    transcriptEvents$,
    transcript: { conversationTurns$, currentTurn$, provisional$ },
    getHistory: () =>
      restoreBrowserBingoHistory(kit.getObservables(EventLogPlugin).events$.getAll()),
    close: () => {
      methods.close();
      bingoMethods.close();
    },
  };
};
