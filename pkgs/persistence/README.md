# @katakit/persistence

Persists an event log through an application-supplied append adapter. The plugin
does not choose a database, identify your stored log, or serialize event values.

```ts
import { makePersistencePlugin } from '@katakit/persistence';

const PersistencePlugin = makePersistencePlugin({ eventLogPlugin: EventLogPlugin });
const persistence = PersistencePlugin.configure({
  persistedEventCount: loadedEvents.length,
  appendEvents: async ({ startIndex, events }) => {
    await storage.appendEvents({ logId, startIndex, events });
  },
});
```

Load events before constructing Katakit, supply them to the event-log plugin, and
register both configured plugins. `persistedEventCount` is the number already
durable, not necessarily the entire in-memory history. It must identify an
existing prefix. The adapter captures application identity such as `logId`.

## Writing and recovery

Starting Katakit saves any unsaved suffix. Later events trigger another flush.
A per-runtime `p-limit(1)` serializes flushes. Concurrent callers join the same
flush result; events arriving during a write are collected into the next batch.
The plugin starts no timers.

Each batch contains a zero-based `startIndex` and an ordered `events` array.
The adapter resolves only after the whole batch is durable. It must safely
recognize retries at the same positions: a request can commit and then lose its
acknowledgement. The plugin does not promise exactly-once external side effects.

A failed batch leaves the durable cursor unchanged. New events or an explicit
`flush()` retry the pending suffix in order. There is no background retry timer.
Status exposes the last failure; automatic effect failures also follow core's
error reporting. A successful drain clears the failure.

```ts
const methods = runtime.getMethods(PersistencePlugin);
await methods.flush();
const status = methods.getPersistenceStatus();
```

`flush()` joins an active flush and drains events accepted while it runs.
Status reports `persistedEventCount`, `pendingEventCount`, `isPersisting`, and
`error`. These are runtime diagnostics, not additional domain events.

Before shutdown, stop producers and await `flush()`. Core does not yet expose a
general disposal lifecycle, so this plugin cannot automatically guarantee an
end-of-process drain. Unacknowledged writes are recovered by reloading the
durable history on the next run. One runtime owns writes to one stored log;
cross-process writer coordination belongs to the adapter/host.

## Development

Run `pnpm --filter @katakit/persistence test:ci` from the workspace root. Tests
select source exports for core and event-log; no build is required.
