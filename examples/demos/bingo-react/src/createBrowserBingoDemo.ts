import { makeKatakit, property } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import { makeBingoPlugin, parseBingoEvent, type BingoEvent } from './bingo';
import {
  makeTranscriptIngestionPlugin,
  type TranscriptRecordedEvent,
} from '@katakit/transcript-ingestion';
import { filter, map } from 'rxjs';
import { parseBrowserBingoEvent, browserBingoEventSchema } from './history';

export type BrowserBingoEvent =
  | { type: 'bingo'; event: BingoEvent }
  | { type: 'transcript'; event: TranscriptRecordedEvent };

/** One in-memory host log; restoring it runs only deterministic content projections. */
export const createBrowserBingoDemo = ({
  initialEvents = [],
}: { initialEvents?: BrowserBingoEvent[] } = {}) => {
  const log = makeEventLogPlugin<BrowserBingoEvent>({ validateEvent: browserBingoEventSchema });
  const logKit = makeKatakit({
    plugins: [log.configure({ initialEvents: initialEvents.map(parseBrowserBingoEvent) })],
  });
  const { events$ } = logKit.getObservables(log);
  const { emitEvent } = logKit.start().getMethods(log);
  const transcript = makeTranscriptIngestionPlugin<BrowserBingoEvent>({
    eventLog: {
      events$,
      emitEvent,
      toEvent: event => ({ type: 'transcript', event }),
      fromEvent: event => (event.type === 'transcript' ? event.event : undefined),
    },
  });
  const bingo = makeBingoPlugin({
    TranscriptIngestionPlugin: transcript,
    eventLog: {
      events$: events$.pipe(
        filter(event => event.type === 'bingo'),
        map(event => event.event)
      ),
      emitEvent: event => emitEvent({ type: 'bingo', event: parseBingoEvent(event) }),
    },
  });
  const kit = makeKatakit({ plugins: [transcript.configure({}), bingo.configure({})] });
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
    getHistory: () => events$.getAll().map(parseBrowserBingoEvent),
    close: () => {
      methods.close();
      bingoMethods.close();
    },
  };
};
