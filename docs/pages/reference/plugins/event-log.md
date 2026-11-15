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

`initialEvents` are added without revalidation. See [event history](../../concepts/event-history.md) and [Getting started](../../getting-started/README.md).
