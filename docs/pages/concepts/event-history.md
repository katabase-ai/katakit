# Derive state from events

Continue with `eventLog.ts` from [Start a runtime](runtime.md). The event log records what happened. A **projection** accumulates those events into the value an interface needs, such as the list of message texts.

Replace `main.ts` with:

```ts
import { makeKatakit, property } from '@katakit/core';
import { scan, shareReplay, startWith } from 'rxjs';
import { EventLogPlugin } from './eventLog';

const runtime = makeKatakit({
  plugins: [EventLogPlugin.configure({ initialEvents: [] })],
});
const { events$ } = runtime.getObservables(EventLogPlugin);
const messages$ = property(
  events$.pipe(
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

## Rebuild from history

Replace `initialEvents: []` above with:

```ts
initialEvents: [{ type: 'message', text: 'Earlier message' }];
```

The first `messages$.get()` now returns `['Earlier message']`, before `start()`. After the two emissions, it returns `['Earlier message', 'Hello', 'Let’s make a plan.']`.

The event log replays stored events synchronously when the projection subscribes. Rebuilding this value needs no method calls, network requests, or running effects. Loading events from storage comes later; the host must validate that loaded history before configuration.

`get()` reads once. A UI should subscribe to `messages$` to receive updates. That subscription's owner must unsubscribe when the view goes away. Core's property helper keeps its own subscription; removing a UI subscription does not dispose the runtime.

Next: [put this projection inside a plugin](plugins.md). The [event-log reference](../reference/plugins/event-log.md) owns the replay and validation contract.
