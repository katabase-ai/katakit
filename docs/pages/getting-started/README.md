# Getting started

Katakit composes framework-independent plugins into a runtime. The event-log plugin provides an ordered, replayable stream of events; persistence is optional.

The packages in this repository are currently version `0.0.0`. For development in this workspace, run `pnpm install` at the repository root. When the packages are available to your application, it needs `@katakit/core`, `@katakit/event-log`, and a synchronous [Standard Schema](https://github.com/standard-schema/standard-schema) validator. This example uses Valibot.

## Start a runtime

```ts
import { makeKatakit } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import * as v from 'valibot';

const EventLogPlugin = makeEventLogPlugin({
  validateEvent: v.strictObject({
    type: v.literal('message'),
    text: v.string(),
  }),
});

const eventLog = EventLogPlugin.configure({ initialEvents: [] });
const runtime = makeKatakit({ plugins: [eventLog] });
const running = runtime.start();

const { events$ } = running.getObservables(EventLogPlugin);
const subscription = events$.subscribe(event => console.log(event));
running.getMethods(EventLogPlugin).emitEvent({ type: 'message', text: 'Hello' });

console.log(events$.getAll()); // [{ type: 'message', text: 'Hello' }]
subscription.unsubscribe();
```

`makeKatakit` accepts **configured** plugins. `start()` starts methods and effects once; it returns the running runtime, which exposes `getMethods`. The original runtime also has `getObservables` for observable-only reads without starting methods or effects.

Next, read [how runtimes work](../concepts/runtime.md), [how plugins fit together](../concepts/plugins.md), or the [API reference](../reference/README.md).
