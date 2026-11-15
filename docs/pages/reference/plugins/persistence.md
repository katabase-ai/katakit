# Persistence

`@katakit/persistence` exports two plugin factories. Both require an event-log plugin factory and register a plugin of type `EventPersistence`. Configure the returned factory with `{}` and register it alongside the configured event log.

## makeEventPersistencePlugin

```ts
import { makeEventPersistencePlugin } from '@katakit/persistence';

const PersistencePlugin = makeEventPersistencePlugin({
  EventLogPlugin,
  appendEvents: async events => {
    await storage.appendEvents(events);
  },
  persistInterval: 5000,
});
const persistence = PersistencePlugin.configure({});
```

`appendEvents(events)` receives an ordered batch and may return a promise. `persistInterval` is in milliseconds and defaults to `5000`. The plugin exposes `getMethods(PersistencePlugin).kill(): Promise<void>` to stop its timer and queue a final flush. Write errors are logged and retried later; a successful `kill()` return does not guarantee that a failed batch reached storage.

## makeLocalStorageEventPersistencePlugin

`makeLocalStorageEventPersistencePlugin({ EventLogPlugin, localStorageKey, persistInterval? })` uses browser `localStorage` as the append callback. It stores a JSON array at `localStorageKey`. Load and validate the prior array yourself before configuring the event log with it. Values must survive JSON serialization, and concurrent tabs are not coordinated.

For hydration, failure, and shutdown semantics, see [persistence concepts](../../concepts/persistence.md).
