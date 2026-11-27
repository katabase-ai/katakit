# Derive state from events

Continue with `eventLog.ts` from [Start a runtime](runtime.md). The event log records what happened. A **projection** accumulates those events into the value an interface needs, such as the list of message texts.

Replace `main.ts` with:

```ts
import { EventLogPlugin, makeKatakit, property } from '@katakit/core';
import { filter, scan, shareReplay, startWith } from 'rxjs';

const runtime = makeKatakit({
  plugins: [],
});
const { events$ } = runtime.getObservables(EventLogPlugin);
const messages$ = property(
  events$.pipe(
    filter(event => event.type === 'message'),
    scan((messages: string[], event) => [...messages, event.text], []),
    startWith([] as string[]),
    shareReplay({ bufferSize: 1, refCount: true })
  )
);

console.log(messages$.get()); // []
const running = runtime.start();
const { emitEvent } = running.getMethods(EventLogPlugin);
emitEvent({ type: 'message', text: 'Hello' });
emitEvent({ type: 'message', text: 'Let’s make a plan.' });
console.log(messages$.get()); // ['Hello', 'Let’s make a plan.']
```

`scan` accumulates a new list for each event. `startWith` supplies an empty list before any events arrive. `shareReplay` shares the calculation and gives new subscribers its latest result. Katakit's `property` subscribes immediately and adds `get()` for synchronous reads.

The list has no separate setter. Adding a message means recording an event; the projection updates the list. Keep this calculation deterministic so the same events produce the same list.

## Why these events and this projection?

This feature accepts messages and displays their texts in order. The event records the
accepted text; the array is a view of that history. We do not need a separate `listChanged`
event whenever the array grows. The empty array is the projection's initial value.

This small feature only appends messages. If users must edit or remove particular messages,
give messages stable IDs and define those actions before extending the projection. Generate
IDs in the live path and record them, rather than assigning new ones while replaying.
See [choosing facts that preserve meaning](event-sourcing.md#choose-facts-that-preserve-meaning)
for a richer example with manual and spoken input.

## Rebuild from history

To seed that runtime, add the following to the `makeKatakit` options beside `plugins`:

```ts
existingEvents: [
  { type: 'message', text: 'Earlier message', meta: { seq: 0, timestamp: new Date(0) } },
];
```

The first `messages$.get()` now returns `['Earlier message']`, before `start()`. After the two emissions, it returns `['Earlier message', 'Hello', 'Let’s make a plan.']`.

The event log replays stored events synchronously when the projection subscribes. Rebuilding this value needs no method calls, network requests, or running effects. Loading events from storage comes later; the host must validate that loaded history before configuration.

`get()` reads once. A UI should subscribe to `messages$` to receive updates. That subscription's owner must unsubscribe when the view goes away. Core's property helper keeps its own subscription; removing a UI subscription does not dispose the runtime.

Next: [put this projection inside a plugin](plugins.md). See the [built-in event log](../reference/core.md#built-in-event-log) for the replay contract.
