# @katakit/core

`@katakit/core` connects typed plugins in a framework-independent runtime. Plugins expose streams of values, callable methods, and effects that react to stream values. The application owns the UI, inputs, storage, and external connections.

## Example

This runtime records messages and derives a count from their history:

```ts
import { EventLogPlugin, makeKatakit, makeKatakitPlugin, property } from '@katakit/core';
import { filter, scan, shareReplay, startWith } from 'rxjs';

const MessageCountPlugin = makeKatakitPlugin({
  type: 'MessageCount',
  configure: (options: {}) => options,
  observables: ({ getObservables }) => ({
    count$: property(
      getObservables(EventLogPlugin).events$.pipe(
        filter(event => event.type === 'message'),
        scan(count => count + 1, 0),
        startWith(0),
        shareReplay({ bufferSize: 1, refCount: true })
      )
    ),
  }),
});
const running = makeKatakit({
  plugins: [MessageCountPlugin.configure({})],
}).start();

running.getMethods(EventLogPlugin).emitEvent({ type: 'message', text: 'Hello' });
console.log(running.getObservables(MessageCountPlugin).count$.get()); // 1
```

## makeKatakit

`makeKatakit({ plugins })` accepts **configured** plugins and returns `getObservables(plugin)` and `start()`. Observable collections are created on first lookup and cached within that runtime. Reading them does not construct methods or subscribe effects.

`start()` may be called once. It initializes each registered plugin's methods and effects, subscribes the effects, and returns `getObservables(plugin)` and `getMethods(plugin)`. Starting again throws. Method collections are also cached per runtime.

Both lookup functions match by plugin `type`. Missing types throw on lookup; duplicate types throw on runtime construction. Core registers the event log automatically.

## Built-in event log

Every runtime has its own in-memory log. Pass `existingEvents` to restore history before starting, or omit it to start empty:

```ts
import { EventLogPlugin, makeKatakit } from '@katakit/core';

const kit = makeKatakit({
  plugins: [],
  existingEvents: [{ type: 'opened', meta: { seq: 0, timestamp: new Date(0) } }],
});
const { events$ } = kit.getObservables(EventLogPlugin);
kit.start().getMethods(EventLogPlugin).emitEvent({ type: 'closed' });
console.log(events$.getAll().map(e => e.type)); // ['opened', 'closed']
```

Core appends the payload with `meta.seq` (the prior event count) and `meta.timestamp` (a `Date`). The application validates external input before emitting it and validates complete recorded events before supplying `existingEvents`. The standalone `@katakit/event-log` package is retired; do not register another `EventLog` plugin.

## makeKatakitPlugin

`makeKatakitPlugin({ type, configure, observables?, methods?, effects? })` creates a plugin factory. Calling its `configure(inputOptions)` transforms the input and produces the configured value registered in a runtime. The callbacks receive that transformed configuration as `options`.

| Callback      | Context                                                           | Result                                       |
| ------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| `observables` | `options`, `getObservables`                                       | Observable collection with `$`-suffixed keys |
| `methods`     | `options`, own `observables`, `getObservables`, `getMethods`      | Collection of callable functions             |
| `effects`     | `options`, own `observables` and `methods`, both lookup functions | Array of effects                             |

Omitted callbacks produce empty collections. A method records an event when it changes replayable application content. An observable derives content from those events. Effects handle work triggered by streams, including external calls whose accepted results can become new events.

Look up another plugin's methods inside the returned method when dependencies can call each other. Mutually dependent `getMethods` calls during method construction can recurse before either collection is cached.

## makeEffect

`makeEffect({ on, backpressure, handler })` creates an effect. `on` is an RxJS observable. `handler(value)` can return `void` or a promise; the runtime subscribes when it starts.

Choose how the effect handles values that arrive while a handler is busy:

- `queue`: handle every value in arrival order, one at a time.
- `latest`: finish the active handler, then handle only the newest pending value. It does not cancel the active handler.
- `none`: start each handler without waiting for earlier handlers. Use this for a one-shot effect or when handler runs may overlap.

Handlers' errors are logged rather than propagated to the caller of `start()`. To avoid repeating external work during history reconstruction, use `skipReplay()` on an effect's event-log input. Keep the full history available to projections.

For example, the [structured notes demo](https://github.com/katabase-ai/katakit/tree/main/examples/demos/notes) uses `latest` to process accumulated turns from its last accepted cursor. It advances that cursor only after validated model output, so replacing pending signals does not discard unprocessed turns. Clear and close abort the active request and discard late results. The demo owns its prompt, validation, and effect-stream closure; its host owns model admission and transport.

## Reactive helpers

An **observable** is a stream of values. A **projection** accumulates events into a derived value, such as the count in the example. Keep projections deterministic so replay reconstructs the same content without network requests or new IDs.

| Export                         | Behavior                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `eager(observable)`            | Subscribes immediately and adds `getAll()` for a snapshot of observed values.                   |
| `property(observable)`         | Subscribes immediately and adds `get()`; requires a synchronous, non-`undefined` initial value. |
| `optionalProperty(observable)` | Subscribes immediately and adds `get()`, initially `undefined` if no value has arrived.         |
| `evolve(reducer, seed)`        | Accumulates source values; the seed itself is not emitted.                                      |
| `skipReplay()`                 | Skips values delivered synchronously during subscription, including replayed values.            |
| `collectReplay(observable)`    | Collects values delivered synchronously during a temporary subscription.                        |

`property` tracks a current value; it does not make the underlying stream replay to new subscribers. Use an appropriate replaying source or RxJS `shareReplay`, as in the example. `startWith` supplies an initial value for a projection over an empty log. Source errors invalidate synchronous reads rather than returning stale state.

## Ownership and shutdown

Each runtime caches its own observable and method collections. Configuration values come from `configure`, which runs before registration. If a configuration contains a subject or another mutable resource, reusing that configured value shares the resource. Configure resource-owning plugins separately for independent application instances.

Core has no general stop or dispose method. Applications must stop input producers and release the resources their plugins or adapters own. The persistence plugin's `kill()` stops its timer and requests a final flush; transcript ingestion's `close()` only cancels its timer. The input owner must call ingestion's `flush()` separately after draining input to finalize a pending turn. Neither cleanup method stops other plugins.

Unsubscribing a view releases that subscription. It does not release subscriptions made by `property`, `optionalProperty`, `eager`, or runtime effects. A long-lived application must explicitly bound the source streams and external work it owns.
