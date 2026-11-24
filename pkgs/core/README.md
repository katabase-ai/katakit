# @katakit/core

Framework-independent plugin composition, reactive utilities, and runtime APIs.
Import the public API from the package root:

```ts
import { makeKatakit, makeKatakitPlugin, eager, evolve, property } from '@katakit/core';
```

Built as ESM with TypeScript declarations.

Every runtime includes an in-memory event log. Import `EventLogPlugin` from
`@katakit/core` to access it; see the [core reference](../../docs/pages/reference/core.md#built-in-event-log)
for replay, restored history, and schema validation.
