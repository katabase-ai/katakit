# @katakit/core

Framework-independent plugin composition, reactive utilities, and runtime APIs.
Import the public API from the package root:

```ts
import { makeKatakit, makeKatakitPlugin, eager, evolve, property } from '@katakit/core';
```

Built as ESM with TypeScript declarations.

Plugin methods and effect handlers emit OpenTelemetry spans when the host configures
a tracing SDK. Core depends only on `@opentelemetry/api`; it installs no exporter or
context manager. Pass `tracer: false` to `makeKatakit` to disable instrumentation for
one runtime. See the [tracing guide](../../docs/pages/reference/tracing.md) for setup,
span attributes, and execution boundaries.
