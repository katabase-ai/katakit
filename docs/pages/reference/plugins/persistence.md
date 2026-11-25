# @katakit/persistence

`@katakit/persistence` appends new event-log entries to application-owned storage. It batches writes and retries failed batches. The application chooses the stored log's identity and loads its history before constructing the runtime.

## Example

Here `store` is the application's storage adapter. Its loader validates the event payloads and metadata and returns recorded events in order:

```ts
import { EventLogPlugin, makeKatakit } from '@katakit/core';
import { makeEventPersistencePlugin } from '@katakit/persistence';

const existingEvents = await store.load('messages');
const PersistencePlugin = makeEventPersistencePlugin({
  appendEvents: events => store.append('messages', events),
});
const running = makeKatakit({
  existingEvents,
  plugins: [PersistencePlugin.configure({})],
}).start();

running.getMethods(EventLogPlugin).emitEvent({ type: 'message', text: 'Hello' });
await running.getMethods(PersistencePlugin).kill();
```

## makeEventPersistencePlugin

`makeEventPersistencePlugin({ appendEvents, persistInterval? })` creates a factory of type `EventPersistence`. Configure it with `{}` and register it. It subscribes to the runtime's built-in log.

- `appendEvents(events)`: an ordered batch writer returning `void` or `Promise<void>`. Resolve only after the whole batch is durable.
- `persistInterval`: milliseconds between flush requests; defaults to `5000`.

Use this factory for a database or another storage service. The callback owns storage identity, transactions, and acknowledgement semantics.

## Restoring the log

Persist the whole ordered log, including provisional transcript events. Core uses the restored count for the next sequence number, so a filtered archive is not a restart log. JSON serializes `meta.timestamp` to a string; the loader must validate it and restore a `Date`. Keep existing IDs and sequence numbers. The application owns migration of older formats.

## Observables and methods

The plugin exposes no observables. `getMethods(PersistencePlugin).kill(): Promise<void>` stops its timer and queues a final serialized flush.

Stop event producers before calling `kill()`. It does not stop the event-log subscription, dispose the runtime, or reject when the append callback fails. New events arriving afterward can remain pending with no timer to flush them.

## Writes, retries, and shutdown

The plugin declares no effects; its methods initialization creates the event subscription and timer when the runtime starts. It skips the history replayed during subscription, so loaded events are not appended again.

Writes run one at a time. Events arriving during a write stay pending for a later batch. If a write fails, its batch returns to the front of the pending events and the error is logged. A later timer tick can retry it. If the final flush fails after `kill()` has stopped the timer, there is no automatic later tick.

An uncertain acknowledgement can repeat a batch. Katakit provides neither exactly-once storage nor deduplication; an adapter that needs those guarantees must enforce them. A resolved `kill()` does not establish durability after a failed write. Abrupt process termination can also lose pending events.

Follow [Restore and save history](../../concepts/persistence.md) for a reload exercise using these boundaries.
