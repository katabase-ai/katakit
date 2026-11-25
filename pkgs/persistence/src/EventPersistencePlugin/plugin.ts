import { EventLogPlugin, KatakitEvent, makeKatakitPlugin, skipReplay } from '@katakit/core';
import pLimit from 'p-limit';

/**
 * Persists an event log's unsaved suffix through a caller-owned storage adapter.
 * Loading history, identifying the stored log, and stopping producers remain host responsibilities.
 */
export const makeEventPersistencePlugin = ({
  appendEvents,
  persistInterval,
}: {
  appendEvents: (events: KatakitEvent[]) => void | Promise<void>;
  persistInterval?: number;
}) =>
  makeKatakitPlugin({
    type: 'EventPersistence',
    configure: (options: {}) => options,
    methods: ({ getObservables }) => {
      const { events$ } = getObservables(EventLogPlugin);

      // only one flush should run at a time
      // other invokations are ignored.
      // exception: end of meeting flush is queued instead of being ignored.
      // see p-limit docs for more details.
      // TODO: use an effect instead.
      const flushLimit = pLimit(1);

      let pendingEvents: KatakitEvent[] = [];

      const flush = async () => {
        if (!pendingEvents.length) return;

        const eventsToPersist = pendingEvents;
        pendingEvents = [];

        try {
          await appendEvents(eventsToPersist);
        } catch (error) {
          // The transaction rolled back. Retry its events before anything emitted
          // during the failed write, otherwise later slide updates can lose their creation.
          pendingEvents = [...eventsToPersist, ...pendingEvents];
          console.error('Failed to flush events:', error);
        }
      };

      events$.pipe(skipReplay()).subscribe(async event => {
        pendingEvents.push(event);
      });

      const intervalId = setInterval(() => {
        flushLimit(flush);
      }, persistInterval ?? 5000);

      const kill = async () => {
        clearInterval(intervalId);
        // flush immediately.
        // if there's already a flush happening, this will be queued.
        await flushLimit(flush);
      };

      return {
        kill,
      };
    },
  });
