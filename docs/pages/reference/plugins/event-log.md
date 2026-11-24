# @katakit/event-log

`@katakit/event-log` records an ordered, replayable history in memory. Use it as the source for application content that should be reconstructable from events. Storage is optional and belongs to a separate [persistence plugin](persistence.md).

## Example

```ts
import { makeKatakit } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import * as v from 'valibot';

const EventLogPlugin = makeEventLogPlugin({
  validateEvent: v.strictObject({ type: v.literal('message'), text: v.string() }),
});
const eventLog = EventLogPlugin.configure({ initialEvents: [] });
const runtime = makeKatakit({ plugins: [eventLog] });
const running = runtime.start();

running.getMethods(EventLogPlugin).emitEvent({ type: 'message', text: 'Hello' });
const history = running.getObservables(EventLogPlugin).events$.getAll();
// history contains [{ type: 'message', text: 'Hello' }].
```

## Configuration

`makeEventLogPlugin({ validateEvent })` creates a factory of type `EventLog`. `validateEvent` is a synchronous Standard Schema validator; its output type determines the event type.

`EventLogPlugin.configure({ initialEvents })` requires an array of events. The host loads and validates that array before configuration. The log replays it as supplied without revalidation. Registering this plugin configures the runtime's [built-in log](../core.md#built-in-event-log); omit `existingEvents` from `makeKatakit` when registering it.

## Observables

`getObservables(EventLogPlugin).events$` emits the complete history synchronously to each new subscriber, then emits subsequent events in order. `events$.getAll()` returns a snapshot array of the history. Mutating that array does not append to the log.

Derive lists, counts, and other application values from this history instead of keeping a second writable copy. These projections can run through `getObservables` before starting methods or effects.

## Methods

After `start()`, `getMethods(EventLogPlugin).emitEvent(event)` validates and publishes one event synchronously. Invalid input throws without recording an event. A successful schema transformation publishes the transformed value.

## Effects and lifecycle

This plugin declares no effects. It records initial history when its observables are first constructed and retains every event for that runtime's lifetime. It has no close or history-trimming method.

The log does not load or write storage. Replaying its events also does not distinguish a historical event from a new one for downstream effects; those effects must use an appropriate input such as `events$.pipe(skipReplay())` when external work should run only for new events.

## Validation requirements

`validateEvent` accepts the [Standard Schema v1](https://standardschema.dev/schema) interface (`StandardSchemaV1<unknown, Event>`), rather than a particular library's schema type. Valibot is one example; compatible versions of Zod, ArkType, or another implementation can also be used with synchronous schemas. No single validation library is required.

- `schema['~standard'].validate(event)` must return its result immediately. Standard Schema permits promises, but this plugin rejects promise-returning validation because `emitEvent` is synchronous. Avoid async refinements and async transforms even if the library otherwise supports Standard Schema.
- A result containing `issues` makes `emitEvent` throw `Invalid event`, with the issues in the error's `cause`. Nothing is published for that call.
- A successful result's `value` is published, including synchronous transformations. The schema's **output** type determines both the stream's event type and the `emitEvent` argument type; the method does not expose a separate schema-input type.
- `initialEvents` are added without revalidation. Validate loaded data before passing it to the plugin.

Follow [Derive state from events](../../concepts/event-history.md) for a complete projection example.
