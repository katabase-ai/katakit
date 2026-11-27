# @katakit/persistence

**Make your app’s history durable.** Preserve the events behind your app, ready to rebuild
its state when needed. Your application chooses the storage and loads history for replay.

This plugin persists new event-log entries through an application-supplied append callback.
The callback receives full recorded events from core's built-in log.

```ts
import { makeEventPersistencePlugin } from '@katakit/persistence';

const PersistencePlugin = makeEventPersistencePlugin({
  persistInterval: 5000,
  appendEvents: async events => {
    await storage.appendEvents({ logId, events });
  },
});
const persistence = PersistencePlugin.configure({});
```

Load and validate events before constructing Katakit, then pass them as
`makeKatakit({ existingEvents, plugins: [persistence] })`. Initial history is treated as already durable
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

Persist the complete history in order, including provisional transcript events.
JSON encodes `meta.timestamp` as a string; validate it and restore a `Date`
before hydration. See the [browser storage example](../../docs/pages/concepts/persistence.md).

## Development

Run `pnpm --filter @katakit/persistence test:ci` from the workspace root. Tests
select source exports for core; no build is required.
