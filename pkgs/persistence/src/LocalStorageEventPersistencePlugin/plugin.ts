import type { makeEventLogPlugin } from '@katakit/event-log';
import { makeEventPersistencePlugin } from '../EventPersistencePlugin/plugin';

/**
 * Persists an event log's unsaved suffix through a caller-owned storage adapter.
 * Loading history, identifying the stored log, and stopping producers remain host responsibilities.
 */
export const makeLocalStorageEventPersistencePlugin = <TEvent>({
  EventLogPlugin,
  localStorageKey,
  persistInterval,
}: {
  EventLogPlugin: ReturnType<typeof makeEventLogPlugin<TEvent>>;
  localStorageKey: string;
  persistInterval?: number;
}) =>
  makeEventPersistencePlugin({
    EventLogPlugin,
    persistInterval,
    appendEvents: events => {
      const existing = JSON.parse(localStorage.getItem(localStorageKey) ?? '[]');
      localStorage.setItem(localStorageKey, JSON.stringify([...existing, ...events]));
    },
  });
