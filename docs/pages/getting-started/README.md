# Getting started

Katakit is an open-source TypeScript developer kit for building voice-to-visual interfaces. It connects application behavior through typed plugins, independently of your UI framework. This first example records a message and reads it back from an event log.

To start with a complete application, choose a [starter](../starters/README.md). The React web
starter connects local microphone recognition to conversation turns and includes built Katakit
packages for use before a registry release. To explore the runtime itself, follow the event-log
example below.

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
const katakit = makeKatakit({ plugins: [eventLog] }).start();

const { events$ } = katakit.getObservables(EventLogPlugin);
const subscription = events$.subscribe(event => console.log(event));
katakit.getMethods(EventLogPlugin).emitEvent({ type: 'message', text: 'Hello' });

console.log(events$.getAll()); // [{ type: 'message', text: 'Hello' }]
subscription.unsubscribe();
```

`makeKatakit` accepts **configured** plugins. `start()` starts methods and effects once; it returns the running runtime, which exposes `getMethods`. The original runtime also has `getObservables` for observable-only reads without starting methods or effects.

Continue with [Concepts](../concepts/README.md) to build a message list from this event history, add a plugin, and save the result. For a React view, see [React integration](react.md). Choose a [platform template](../starters/README.md) for a complete application, or use [Reference](../reference/README.md) to look up a contract.
