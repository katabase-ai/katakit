import { Observable, ReplaySubject } from 'rxjs';
import { makeKatakitPlugin } from '../plugin';
import { eager, type WithEager } from '../utils/reactive/eager';

/**
 * The runtime's built-in event log. Read its replayable history before start,
 * or call emitEvent after start. The default log accepts events as supplied.
 */
export const EventLogPlugin = makeKatakitPlugin({
  type: 'EventLog',
  configure: (options: {
    /**
     * Previously loaded events, replayed as supplied without revalidation.
     */
    existingEvents: readonly unknown[];
  }) => options,
  observables: ({ options }) => {
    // the combination of eager and replay subject represents
    // a stateful pushable array of events.
    // the same could be achieved with a replay subject, and an array with a manual subscription.
    const events$ = eager(new ReplaySubject<unknown>());

    for (const event of options.existingEvents) {
      events$.next(event);
    }

    return {
      // a fake type assertion just to prevent the usage
      // of `event$.next` directly
      /**
       * Replays the complete event history; getAll() returns a snapshot array.
       */
      events$: events$ as WithEager<Observable<unknown>>,
    };
  },
  methods: ({ observables }) => ({
    /**
     * Append one event and notify subscribers synchronously.
     */
    emitEvent: (event: unknown) => {
      (observables.events$ as WithEager<ReplaySubject<unknown>>).next(event);
    },
  }),
});
