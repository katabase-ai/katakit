# Restore and save history

The list can now rebuild itself, but its history still disappears on reload. Supply a batch writer to the persistence plugin. Here the application owns a browser storage key and its JSON format.

Keep `eventLog.ts` and `messageList.ts` from the [plugin step](plugins.md). Add `@katakit/persistence` to your application's available Katakit packages and run this replacement `main.ts` in a browser on a stable origin:

```ts
import { makeKatakit, type KatakitEvent } from '@katakit/core';
import { makeEventPersistencePlugin } from '@katakit/persistence';
import * as v from 'valibot';
import { MessageSchema } from './eventLog';
import { MessageListPlugin } from './messageList';

const key = 'katakit-message-tutorial-v2';
const storedEvent = v.object({
  ...MessageSchema.entries,
  meta: v.object({ seq: v.number(), timestamp: v.pipe(v.string(), v.isoTimestamp()) }),
});
const saved = v.parse(v.array(storedEvent), JSON.parse(localStorage.getItem(key) ?? '[]'));
const existingEvents = saved.map((event, index) => {
  if (event.meta.seq !== index) throw new Error('Incomplete message history');
  return { ...event, meta: { seq: index, timestamp: new Date(event.meta.timestamp) } };
});
// This example has one writer. Update its copy only after storage accepts the batch.
let history: KatakitEvent[] = [...existingEvents];
const PersistencePlugin = makeEventPersistencePlugin({
  appendEvents: batch => {
    const next = [...history, ...batch];
    localStorage.setItem(key, JSON.stringify(next));
    history = next;
  },
});
const running = makeKatakit({
  existingEvents,
  plugins: [MessageListPlugin.configure({}), PersistencePlugin.configure({})],
}).start();

const { messages$ } = running.getObservables(MessageListPlugin);
console.log(messages$.get()); // First visit: []
running.getMethods(MessageListPlugin).addMessage('Saved message');

// This finite example has no more event producers. Flush and stop its storage timer.
await running.getMethods(PersistencePlugin).kill();
console.log(messages$.get()); // First visit: ['Saved message']
```

Reload once. The first read now contains `Saved message`; the second contains it twice because this example adds one new event on every visit. Restored events are not appended again. The effect prints only the newly added message.

## Loading and flushing

The host validates the saved array before supplying `existingEvents`. JSON turns each `meta.timestamp` into a string; the loader restores it to a `Date`. This app only records messages. An app with other producers needs a stored schema that covers their events too.

The persistence plugin normally writes batches every five seconds. This example calls `kill()` after its final event to request an immediate flush and stop the timer. In an interactive application, stop capture and other event producers before this call. A browser closing abruptly can lose events that have not reached storage.

Write errors are logged, and failed batches can be retried. A resolved `kill()` does not prove a failed write became durable. The [persistence reference](../reference/plugins/persistence.md) explains acknowledgements, repeated batches, and the remaining subscription after `kill()`.

To repeat the first-visit check, remove only the `katakit-message-tutorial-v2` key in your browser's storage inspector.

Next: [connect the behavior to an input and a view](templates.md).
