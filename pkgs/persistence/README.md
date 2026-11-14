# @katakit/persistence

Persists new event-log entries through an application-supplied append callback.
The package also supplies a browser local-storage adapter.

```ts
import { makeEventPersistencePlugin } from '@katakit/persistence';

const PersistencePlugin = makeEventPersistencePlugin({
  EventLogPlugin,
  persistInterval: 5000,
  appendEvents: async events => {
    await storage.appendEvents({ logId, events });
  },
});
const persistence = PersistencePlugin.configure({});
```

Load events before constructing Katakit, supply them to the event-log plugin, and
register both configured plugins. Initial history is treated as already durable
and is not appended again. The callback captures application identity such as
`logId`; the plugin does not load history or choose a database.

## Writing and recovery

Starting Katakit creates the persistence method collection, which subscribes to
new events and starts a timer. `persistInterval` defaults to 5000 milliseconds.
`p-limit(1)` serializes batches; events arriving during a write remain pending
for a later batch.

The callback receives an ordered event array and resolves after the entire batch
is durable. On failure, the batch is returned ahead of newer pending events and
the error is logged. A later timer tick retries it. The adapter must account for
uncertain acknowledgements; the plugin does not supply deduplication or promise
exactly-once writes.

Stop producers before shutting down, then stop the timer and request a final
serialized flush:

```ts
await runtime.getMethods(PersistencePlugin).kill();
```

The current implementation logs storage failures, including a failed final
flush; successful `kill()` completion is not proof that every event is durable.
It also retains the event subscription after stopping the timer. Core does not
yet provide a general disposal lifecycle.

## Browser local storage

```ts
import { makeLocalStorageEventPersistencePlugin } from '@katakit/persistence';

const PersistencePlugin = makeLocalStorageEventPersistencePlugin({
  EventLogPlugin,
  localStorageKey: 'meeting-events',
});
```

This adapter appends batches to a JSON array at the supplied key. Load the
existing array into the event log before starting. Event values must support a
JSON round trip; date decoding and validation belong to the host. The adapter
uses browser `localStorage` when saving and does not coordinate concurrent tabs.

## Development

Run `pnpm --filter @katakit/persistence test:ci` from the workspace root. Tests
select source exports for core and event-log; no build is required.
