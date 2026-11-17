# @katakit/persistence

`@katakit/persistence` appends new event-log entries to application-owned storage. It batches writes and retries failed batches. The application chooses the stored log's identity and loads its history before constructing the runtime.

## Example

This browser example loads a validated message history and saves one new event:

```ts
import { makeKatakit } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import { makeLocalStorageEventPersistencePlugin } from '@katakit/persistence';
import * as v from 'valibot';

const MessageSchema = v.strictObject({ type: v.literal('message'), text: v.string() });
const localStorageKey = 'katakit-messages';
const initialEvents = v.parse(
  v.array(MessageSchema),
  JSON.parse(localStorage.getItem(localStorageKey) ?? '[]')
);
const EventLogPlugin = makeEventLogPlugin({ validateEvent: MessageSchema });
const PersistencePlugin = makeLocalStorageEventPersistencePlugin({
  EventLogPlugin,
  localStorageKey,
});
const running = makeKatakit({
  plugins: [EventLogPlugin.configure({ initialEvents }), PersistencePlugin.configure({})],
}).start();

running.getMethods(EventLogPlugin).emitEvent({ type: 'message', text: 'Hello' });
await running.getMethods(PersistencePlugin).kill();
// With writable localStorage, the key contains the prior history followed by the new event.
```

## makeEventPersistencePlugin

`makeEventPersistencePlugin({ EventLogPlugin, appendEvents, persistInterval? })` creates a factory of type `EventPersistence`. Configure it with `{}` and register it alongside the configured event log.

- `EventLogPlugin`: the event-log factory whose new events should be saved.
- `appendEvents(events)`: an ordered batch writer returning `void` or `Promise<void>`. Resolve only after the whole batch is durable.
- `persistInterval`: milliseconds between flush requests; defaults to `5000`.

Use this factory for a database or another storage service. The callback owns storage identity, transactions, and acknowledgement semantics.

## makeLocalStorageEventPersistencePlugin

`makeLocalStorageEventPersistencePlugin({ EventLogPlugin, localStorageKey, persistInterval? })` supplies a browser `localStorage` batch writer. It reads the existing JSON array and writes that array plus each new batch. It uses the same `EventPersistence` type; choose one persistence factory per runtime.

Load and validate the prior array yourself before configuring the event log. Values must survive JSON serialization. The adapter does not decode dates, migrate events, or coordinate concurrent tabs.

## Observables and methods

The plugin exposes no observables. `getMethods(PersistencePlugin).kill(): Promise<void>` stops its timer and queues a final serialized flush.

Stop event producers before calling `kill()`. It does not stop the event-log subscription, dispose the runtime, or reject when the append callback fails. New events arriving afterward can remain pending with no timer to flush them.

## Writes, retries, and shutdown

The plugin declares no effects; its methods initialization creates the event subscription and timer when the runtime starts. It skips the history replayed during subscription, so loaded events are not appended again.

Writes run one at a time. Events arriving during a write stay pending for a later batch. If a write fails, its batch returns to the front of the pending events and the error is logged. A later timer tick can retry it. If the final flush fails after `kill()` has stopped the timer, there is no automatic later tick.

An uncertain acknowledgement can repeat a batch. Katakit provides neither exactly-once storage nor deduplication; an adapter that needs those guarantees must enforce them. A resolved `kill()` does not establish durability after a failed write. Abrupt process termination can also lose pending events.

Follow [Restore and save history](../../concepts/persistence.md) for a reload exercise using these boundaries.
