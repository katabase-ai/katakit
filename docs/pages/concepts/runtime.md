# Start a runtime

A runtime connects configured plugins. Start with an event log that accepts one kind of event: a message with some text. The application supplies the schema so the log knows which values it can accept.

Create `eventLog.ts`:

```ts
import { makeEventLogPlugin } from '@katakit/event-log';
import * as v from 'valibot';

export const MessageSchema = v.strictObject({
  type: v.literal('message'),
  text: v.string(),
});

export const EventLogPlugin = makeEventLogPlugin({ validateEvent: MessageSchema });
```

`EventLogPlugin` is a factory. Configure it with an empty history and register that configured value in `main.ts`:

```ts
import { makeKatakit } from '@katakit/core';
import { EventLogPlugin } from './eventLog';

const runtime = makeKatakit({
  plugins: [EventLogPlugin.configure({ initialEvents: [] })],
});
const { events$ } = runtime.getObservables(EventLogPlugin);
const running = runtime.start();

running.getMethods(EventLogPlugin).emitEvent({ type: 'message', text: 'Hello' });
console.log(events$.getAll());
// [{ type: 'message', text: 'Hello' }]
```

An **observable** is a stream of values you can subscribe to. Here, `events$` emits recorded events in order. Its `$` suffix identifies it as a stream. The event-log plugin also gives it `getAll()` to read the recorded history.

## Before and after start

You can read observables before starting the runtime. `start()` enables method lookup and subscribes plugin effects, which you'll add later. Use the returned `running` value to call methods. Start each runtime once.

`emitEvent` validates the new event and publishes it synchronously. Change `text` to a number and TypeScript rejects the call. Data arriving from outside TypeScript still passes through the runtime validator.

The event exists only in this runtime's memory. Restart the application and the empty `initialEvents` produces an empty log again.

Next: [derive a message list from these events](event-history.md). See [Core](../reference/core.md#makekatakit) for runtime lookup and lifecycle rules.
