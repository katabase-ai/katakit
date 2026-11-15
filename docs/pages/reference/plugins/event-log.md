# Event log

`@katakit/event-log` exports `makeEventLogPlugin({ validateEvent })`. `validateEvent` is a synchronous Standard Schema validator; its output type determines the event type.

```ts
import { makeEventLogPlugin } from '@katakit/event-log';
import * as v from 'valibot';

const EventLogPlugin = makeEventLogPlugin({
  validateEvent: v.strictObject({ type: v.literal('message'), text: v.string() }),
});
const eventLog = EventLogPlugin.configure({ initialEvents: [] });
```

Register `eventLog` with `makeKatakit({ plugins: [eventLog] })`. The plugin's `events$` observable replays the complete history and offers `getAll(): Event[]`, which returns a snapshot array. After `start()`, `getMethods(EventLogPlugin).emitEvent(event)` validates and publishes one event synchronously. Failed validation throws; asynchronous validators are rejected.

## Validation requirements

`validateEvent` accepts the [Standard Schema v1](https://standardschema.dev/schema) interface (`StandardSchemaV1<unknown, Event>`), rather than a particular library's schema type. Valibot is one example; compatible versions of Zod, ArkType, or another implementation can also be used with synchronous schemas. No single validation library is required.

- `schema['~standard'].validate(event)` must return its result immediately. Standard Schema permits promises, but this plugin rejects promise-returning validation because `emitEvent` is synchronous. Avoid async refinements and async transforms even if the library otherwise supports Standard Schema.
- A result containing `issues` makes `emitEvent` throw `Invalid event`, with the issues in the error's `cause`. Nothing is published for that call.
- A successful result's `value` is published, including synchronous transformations. The schema's **output** type determines both the stream's event type and the `emitEvent` argument type; the method does not expose a separate schema-input type.
- `initialEvents` are added without revalidation. Validate loaded data before passing it to the plugin.

See [event history](../../concepts/event-history.md) and [Getting started](../../getting-started/README.md).
