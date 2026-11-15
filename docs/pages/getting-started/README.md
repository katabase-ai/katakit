# Getting started

Katakit composes framework-independent plugins into a runtime. The event-log plugin provides an ordered, replayable stream of events; persistence is optional.

The packages in this repository are currently version `0.0.0`. For development in this workspace, run `pnpm install` at the repository root. When the packages are available to your application, it needs `@katakit/core`, `@katakit/event-log`, and a synchronous [Standard Schema](https://standardschema.dev/schema) validator. This example uses Valibot; any Standard Schema v1 implementation that validates synchronously can be used. See [validation requirements](../reference/plugins/event-log.md#validation-requirements) for limitations.

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

For a React application, continue with [React integration](react.md). You can also read [how runtimes work](../concepts/runtime.md), [how plugins fit together](../concepts/plugins.md), or the [API reference](../reference/README.md).
