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
