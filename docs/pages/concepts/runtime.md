# Start a runtime

A runtime connects configured plugins and provides an event log. This application checks incoming messages with its own schema.

Create `eventLog.ts`:

```ts
import * as v from 'valibot';

export const MessageSchema = v.strictObject({
  type: v.literal('message'),
  text: v.string(),
});
```

Use core's built-in log in `main.ts`:

```ts
import { EventLogPlugin, makeKatakit } from '@katakit/core';
import * as v from 'valibot';
import { MessageSchema } from './eventLog';

const runtime = makeKatakit({
  plugins: [],
});
const { events$ } = runtime.getObservables(EventLogPlugin);
const running = runtime.start();

running
  .getMethods(EventLogPlugin)
  .emitEvent(v.parse(MessageSchema, { type: 'message', text: 'Hello' }));
console.log(events$.getAll()[0]?.meta.seq); // 0
```

An **observable** is a stream of values you can subscribe to. Here, `events$` emits recorded events in order. Its `$` suffix identifies it as a stream. The event-log plugin also gives it `getAll()` to read the recorded history.

## Before and after start

You can read observables before starting the runtime. `start()` enables method lookup and subscribes plugin effects, which you'll add later. Use the returned `running` value to call methods. Start each runtime once.

`v.parse` validates the message before it reaches the log. `emitEvent` records it with a sequence number and timestamp and publishes it synchronously.

The event exists only in this runtime's memory. Restart the application without supplying history and the log starts empty.

Next: [derive a message list from these events](event-history.md). See [Core](../reference/core.md#makekatakit) for runtime lookup and lifecycle rules.
