# Add a plugin and an effect

The [previous step](event-history.md) derived a list directly in `main.ts`. Move that calculation into a plugin so an application can look up the list and call `addMessage(text)` without handling event shapes itself.

Create `messageList.ts` beside `eventLog.ts`:

```ts
import { makeEffect, makeKatakitPlugin, property, skipReplay } from '@katakit/core';
import { scan, shareReplay, startWith } from 'rxjs';
import { EventLogPlugin } from './eventLog';

export const MessageListPlugin = makeKatakitPlugin({
  type: 'MessageList',
  configure: (options: {}) => options,
  observables: ({ getObservables }) => ({
    messages$: property(
      getObservables(EventLogPlugin).events$.pipe(
        scan((messages: string[], event) => [...messages, event.text], []),
        startWith([] as string[]),
        shareReplay({ bufferSize: 1, refCount: true })
      )
    ),
  }),
  methods: ({ getMethods }) => ({
    addMessage: (text: string) => getMethods(EventLogPlugin).emitEvent({ type: 'message', text }),
  }),
  effects: ({ getObservables }) => [
    makeEffect({
      on: getObservables(EventLogPlugin).events$.pipe(skipReplay()),
      backpressure: 'queue',
      handler: event => console.log(`New message: ${event.text}`),
    }),
  ],
});
```

The plugin has three parts:

- **Observables** expose the message list derived from events.
- **Methods** give callers an explicit action. `addMessage` records an event rather than editing the list.
- **Effects** react automatically to values from a stream after the runtime starts. This effect prints a notification for each new message.

`skipReplay()` keeps old messages from triggering the notification when the effect subscribes. It belongs on this effect's input, not on the projection: the list needs the complete history. `queue` handles every new event in order. See [makeEffect](../reference/core.md#makeeffect) for the other scheduling choices.

## Register both plugins

Replace `main.ts` with:

```ts
import { makeKatakit } from '@katakit/core';
import { EventLogPlugin } from './eventLog';
import { MessageListPlugin } from './messageList';

const runtime = makeKatakit({
  plugins: [
    EventLogPlugin.configure({
      initialEvents: [{ type: 'message', text: 'Earlier message' }],
    }),
    MessageListPlugin.configure({}),
  ],
});
const { messages$ } = runtime.getObservables(MessageListPlugin);
console.log(messages$.get()); // ['Earlier message']

const running = runtime.start();
running.getMethods(MessageListPlugin).addMessage('Hello');
console.log(messages$.get()); // ['Earlier message', 'Hello']
// The effect also prints: New message: Hello
```

The runtime resolves `EventLogPlugin` by its registered type. Both plugins must be registered. Reading `messages$` reconstructs the list before effects start; starting does not print a notification for `Earlier message`.

## Calling a model from an effect

A model request can follow the same separation: an effect reads new input, calls a host-supplied connection, validates the result, and records an event. An observable derives the displayed result from that event. Replay then restores the accepted result without calling the model again.

The [structured notes demo](https://github.com/katabase-ai/katakit/tree/main/examples/demos/notes-react) implements that pattern with cancellation and retries. Those resources need application-owned cleanup; core has no general stop method. See [effect ownership](../reference/core.md#ownership-and-shutdown) before replacing the console notification with external work.

Next: [restore and save the message history](persistence.md).
