# Restore and save history

The list can now rebuild itself, but its history still disappears on reload. Use the browser local-storage adapter to append new events. The application first loads and validates the saved history, then configures the event log with it.

Keep `eventLog.ts` and `messageList.ts` from the [plugin step](plugins.md). Add `@katakit/persistence` to your application's available Katakit packages and run this replacement `main.ts` in a browser on a stable origin:

```ts
import { makeKatakit } from '@katakit/core';
import { makeLocalStorageEventPersistencePlugin } from '@katakit/persistence';
import * as v from 'valibot';
import { EventLogPlugin, MessageSchema } from './eventLog';
import { MessageListPlugin } from './messageList';

const localStorageKey = 'katakit-message-tutorial';
const initialEvents = v.parse(
  v.array(MessageSchema),
  JSON.parse(localStorage.getItem(localStorageKey) ?? '[]')
);
const PersistencePlugin = makeLocalStorageEventPersistencePlugin({
  EventLogPlugin,
  localStorageKey,
});
const running = makeKatakit({
  plugins: [
    EventLogPlugin.configure({ initialEvents }),
    MessageListPlugin.configure({}),
    PersistencePlugin.configure({}),
  ],
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

The event log does not validate `initialEvents`, so `v.parse` checks the stored array before it enters the runtime. If parsing fails, the example stops rather than treating incompatible data as valid history.

The persistence plugin normally writes batches every five seconds. This example calls `kill()` after its final event to request an immediate flush and stop the timer. In an interactive application, stop capture and other event producers before this call. A browser closing abruptly can lose events that have not reached storage.

Write errors are logged, and failed batches can be retried. A resolved `kill()` does not prove a failed write became durable. The [persistence reference](../reference/plugins/persistence.md) explains acknowledgements, repeated batches, and the remaining subscription after `kill()`.

To repeat the first-visit check, remove only the `katakit-message-tutorial` key in your browser's storage inspector.

Next: [connect the behavior to an input and a view](templates.md).
