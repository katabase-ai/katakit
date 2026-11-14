import { Observable, ReplaySubject } from 'rxjs';
import { makeKatakitPlugin, eager, type WithEager } from '@katakit/core';
import { StandardSchemaV1 } from '@standard-schema/spec';

export const makeEventLogPlugin = <TEvent>({
  validateEvent,
}: {
  validateEvent: StandardSchemaV1<unknown, TEvent>;
}) =>
  makeKatakitPlugin({
    type: 'EventLog',
    configure: (options: { initialEvents: TEvent[] }) => options,
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
        events$: events$ as WithEager<Observable<TEvent>>,
      };
    },
    methods: ({ observables }) => ({
      emitEvent: (event: TEvent) => {
        const validationResult = validateEvent['~standard'].validate(event);
        if (validationResult instanceof Promise) {
          throw new Error('Event validation must be synchronous');
        }
        if (!('value' in validationResult)) {
          throw new Error('Invalid event', { cause: validationResult.issues });
        }
        const validEvent = validationResult.value;
        (observables.events$ as WithEager<ReplaySubject<TEvent>>).next(validEvent);
      },
    }),
  });
