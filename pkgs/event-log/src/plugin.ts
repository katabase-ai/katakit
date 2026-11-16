import { Observable, ReplaySubject } from 'rxjs';
import { makeKatakitPlugin, eager, type WithEager } from '@katakit/core';
import { StandardSchemaV1 } from '@standard-schema/spec';

/**
 * Create an event-log plugin with replayable history and synchronous validated emissions.
 * The host owns loading and validating initial history before configuration.
 */
export const makeEventLogPlugin = <TEvent>({
  validateEvent,
}: {
  /**
   * Synchronous Standard Schema validator. Its output is the event type; invalid events throw.
   */
  validateEvent: StandardSchemaV1<unknown, TEvent>;
}) =>
  makeKatakitPlugin({
    type: 'EventLog',
    configure: (options: {
      /**
       * Previously loaded events, replayed as supplied without revalidation.
       */
      initialEvents: TEvent[];
    }) => options,
    observables: ({ options }) => {
      // the combination of eager and replay subject represents
      // a stateful pushable array of events.
      // the same could be achieved with a replay subject, and an array with a manual subscription.
      const events$ = eager(new ReplaySubject<TEvent>(Infinity));

      for (const event of options.initialEvents) {
        events$.next(event);
      }

      return {
        // a fake type assertion just to prevent the usage
        // of `event$.next` directly
        /**
         * Replays the complete event history; getAll() returns a snapshot array.
         */
        events$: events$ as WithEager<Observable<TEvent>>,
      };
    },
    methods: ({ observables }) => ({
      /**
       * Validate and publish one event synchronously; asynchronous validators are rejected.
       */
      emitEvent: (event: TEvent) => {
        const validationResult = validateEvent['~standard'].validate(event);
        if (validationResult instanceof Promise) {
          throw new Error('Event validation must be synchronous');
        }
        if (validationResult.issues) {
          throw new Error('Invalid event', { cause: validationResult.issues });
        }
        const validEvent = validationResult.value;
        (observables.events$ as WithEager<ReplaySubject<TEvent>>).next(validEvent);
      },
    }),
  });
