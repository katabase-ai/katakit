# @katakit/event-log

A Katakit plugin exposing replayable `events$` history and an `emitEvent` method.

```ts
import { makeEventLogPlugin } from '@katakit/event-log';
import * as v from 'valibot';

const EventLogPlugin = makeEventLogPlugin({
  validateEvent: v.strictObject({
    type: v.literal('message'),
    text: v.string(),
  }),
});
const eventLog = EventLogPlugin.configure({
  initialEvents: [],
});
```

Register the configured plugin with Katakit. Read its observable through
`getObservables(EventLogPlugin)` and its methods through `getMethods(EventLogPlugin)`.
`events$.getAll()` returns a copy of the history.

The schema determines the event type and transformations applied to live emissions.
Asynchronous validation is unsupported.

## Development

Run `pnpm --filter @katakit/event-log test:ci` from the workspace root. Its Vite
configuration selects the workspace-only `source` export condition, so tests use
current core and event-log source without a preceding build. Tools that do not
select this condition continue to use the normal `dist/` exports.
