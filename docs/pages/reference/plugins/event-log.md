# Event log

The event log is an ordered, replayable stream. Supply previously loaded events when configuring the plugin; use `emitEvent` for new events that must be validated. The host is responsible for loading and validating stored history before handing it to the plugin.

```ts
import { makeKatakit } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import * as v from 'valibot';

const EventLogPlugin = makeEventLogPlugin({
  validateEvent: v.strictObject({ type: v.literal('message'), text: v.string() }),
});
const eventLog = EventLogPlugin.configure({ initialEvents: [] });
const runtime = makeKatakit({ plugins: [eventLog] });
const running = runtime.start();

running.getMethods(EventLogPlugin).emitEvent({ type: 'message', text: 'Hello' });
console.log(running.getObservables(EventLogPlugin).events$.getAll());
```

Validation applies to live emissions, not `initialEvents`. The validator must be synchronous; its output determines the event type, including any transformations it makes.

## makeEventLogPlugin

Create an event-log plugin with replayable history and synchronous validated emissions.
The host owns loading and validating initial history before configuration.

`import { makeEventLogPlugin } from '@katakit/event-log'`

```text
makeEventLogPlugin<TEvent>(options: { validateEvent: StandardSchemaV1<unknown, TEvent>; }): KatakitPlugin<{ initialEvents: TEvent[]; }, { events$: WithEager<Observable<TEvent>>; }, { emitEvent: (event: TEvent) => void; }>
```

### Factory options

- `validateEvent: StandardSchemaV1<unknown, TEvent>` — Synchronous Standard Schema validator. Its output is the event type; invalid events throw.

### Configuration

`makeEventLogPlugin(...).configure(options)` accepts:

- `initialEvents: TEvent[]` — Previously loaded events, replayed as supplied without revalidation.

### Observables

After registration, access these with `getObservables(EventLogPlugin)`:

- `events$: WithEager<Observable<TEvent>>` — Replays the complete event history; getAll() returns a snapshot array.

### Methods

After `start()`, access these with `getMethods(EventLogPlugin)`:

- `emitEvent: (event: TEvent) => void` — Validate and publish one event synchronously; asynchronous validators are rejected.

[Event history](../../concepts/event-history.md) · [Getting started](../../getting-started/README.md)
