# Getting started

Katakit composes framework-independent plugins into a runtime. The event-log plugin provides an ordered, replayable stream of events; persistence is optional.

To start with a complete application, choose a [starter](../starters/README.md). The React web
starter connects local microphone recognition to conversation turns and installs Katakit
packages from npm. To explore the runtime itself, follow the event-log
example below.

Install the packages for this example in your application:

```sh
pnpm add @katakit/core@0.1.0 @katakit/event-log@0.1.0 valibot
```

The event-log plugin needs a synchronous [Standard Schema](https://standardschema.dev/schema) validator. This example uses Valibot; any Standard Schema v1 implementation that validates synchronously can be used. See [validation requirements](../reference/plugins/event-log.md#validation-requirements) for limitations.

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
const katakit = makeKatakit({ plugins: [eventLog] }).start();

const { events$ } = katakit.getObservables(EventLogPlugin);
const subscription = events$.subscribe(event => console.log(event));
katakit.getMethods(EventLogPlugin).emitEvent({ type: 'message', text: 'Hello' });

console.log(events$.getAll()); // [{ type: 'message', text: 'Hello' }]
subscription.unsubscribe();
```

`makeKatakit` accepts **configured** plugins. `start()` starts methods and effects once; it returns the running runtime, which exposes `getMethods`. The original runtime also has `getObservables` for observable-only reads without starting methods or effects.

For a React application, continue with [React integration](react.md). To install and change a runnable application rather than just read a code snippet, choose a [starter](../starters/README.md). You can also read [how runtimes work](../concepts/runtime.md), [how plugins fit together](../concepts/plugins.md), or the [reference](../reference/README.md).
