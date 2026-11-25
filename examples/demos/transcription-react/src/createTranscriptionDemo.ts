import { makeKatakit, property } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import {
  makeTranscriptIngestionPlugin,
  parseTranscriptRecordedEvent,
} from '@katakit/transcript-ingestion';
import { combineLatest, map, shareReplay } from 'rxjs';

/** Own an in-memory log and input lifetime. Restoring history never starts capture or timers. */
export const createTranscriptionDemo = ({
  initialEvents = [],
}: { initialEvents?: readonly unknown[] } = {}) => {
  // Storage is a host choice. Validate every restored record before exposing a runtime.
  const history = initialEvents.map(parseTranscriptRecordedEvent);
  const log = makeEventLogPlugin({
    validateEvent: {
      '~standard': {
        version: 1,
        vendor: 'transcription-demo',
        validate: (value: unknown) => ({ value: parseTranscriptRecordedEvent(value) }),
      },
    },
  });
  const logKit = makeKatakit({ plugins: [log.configure({ initialEvents: history })] }).start();
  const events$ = logKit.getObservables(log).events$;
  const transcript = makeTranscriptIngestionPlugin({
    turnSilenceMs: 1400,
    eventLog: {
      events$,
      emitEvent: logKit.getMethods(log).emitEvent,
      toEvent: event => event,
      fromEvent: event => event,
    },
  });
  const kit = makeKatakit({ plugins: [transcript.configure({})] });
  const methods = kit.start().getMethods(transcript);
  const observables = kit.getObservables(transcript);
  const state = property(
    combineLatest([observables.state$, observables.provisional$]).pipe(
      map(([content, provisional]) => ({
        completedTurns: content.conversationTurns,
        currentTurn: content.currentTurn,
        provisional,
      })),
      shareReplay({ bufferSize: 1, refCount: true })
    )
  );
  // Preserve existing gallery getValue consumers without exposing a writable subject.
  const state$ = Object.assign(state, { getValue: state.get });
  return {
    ...methods,
    state$,
    events$,
    getHistory: () => events$.getAll(),
  };
};
