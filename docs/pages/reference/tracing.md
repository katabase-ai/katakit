# Tracing

Core instruments plugin methods and effect handlers with the OpenTelemetry API.
An invocation produces a span even when it makes no state change. Spans include
execution identity, timing, parent context, and failure status. They are independent
of observable values and application event logs.

Core depends only on `@opentelemetry/api`. The host chooses and initializes the SDK,
context manager, sampling, processors, and exporters. With no registered SDK, the
API does not record telemetry. Core installs no global provider, exports no data
on its own, and owns no trace-history buffer.

## Set up a host

For a Node.js application, install the SDK and context manager alongside core:

```sh
pnpm add @opentelemetry/api @opentelemetry/sdk-trace @opentelemetry/context-async-hooks
```

This standalone example retains traces locally in memory and demonstrates a method
calling another plugin's method after an `await`:

```ts
import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import { makeKatakit, makeKatakitPlugin } from '@katakit/core';

const exporter = new InMemorySpanExporter();
const provider = new TracerProvider({
  spanProcessors: [new SimpleSpanProcessor({ exporter })],
});
context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
trace.setGlobalTracerProvider(provider);

const Reader = makeKatakitPlugin({
  type: 'Reader',
  configure: () => ({}),
  methods: () => ({ read: () => 42 }),
});
const Worker = makeKatakitPlugin({
  type: 'Worker',
  configure: () => ({}),
  methods: ({ getMethods }) => ({
    run: async () => {
      await Promise.resolve();
      return getMethods(Reader).read();
    },
  }),
});
const runtime = makeKatakit({
  plugins: [Reader.configure({}), Worker.configure({})],
}).start();

await runtime.getMethods(Worker).run();
await provider.forceFlush();
console.log(
  exporter.getFinishedSpans().map(span => ({
    name: span.name,
    spanId: span.spanContext().spanId,
    parentSpanId: span.parentSpanContext?.spanId,
    status: span.status.code,
  }))
);
await provider.shutdown();
context.disable();
trace.disable();
```

The `Reader.method.read` span is a child of `Worker.method.run`. Neither method
needs to emit an event. The example owns its global SDK and clears it on exit;
an application with an existing SDK should keep that setup and shutdown policy.

For remote collection, configure an OpenTelemetry exporter and processor in the
host. A batch processor is appropriate for most network exporters. Local developer
tools can consume spans through a host-owned processor or exporter as well.
Core does not prescribe a collector, storage format, or React UI.

### Browser hosts

Core has no Node.js imports. Choose a browser-compatible OpenTelemetry setup. For
synchronous context propagation, the tracing SDK provides:

```ts
import { context } from '@opentelemetry/api';
import { StackContextManager } from '@opentelemetry/sdk-trace';

context.setGlobalContextManager(new StackContextManager().enable());
```

This manager preserves context within synchronous calls. Core explicitly carries
the context from an effect input's arrival into its eventual handler, including
when that handler is queued. Calls made after a native `await` need an async-aware
context manager supported by the host, or explicit OpenTelemetry context handling.
Core does not patch promises or keep a shared mutable "current span".

Without a context manager, spans can still be recorded but nested relationships
are not established. Browser context propagation needs verification against the
application's actual build and runtime.

## Runtime configuration

`makeKatakit({ plugins })` uses the global tracer with instrumentation scope
`@katakit/core`. To use a particular host-owned tracer, pass
`makeKatakit({ plugins, tracer: provider.getTracer('my-runtime') })`. A dedicated
tracer scope can distinguish runtimes in a local inspection view. To bypass both
method wrapping and effect-context capture, pass `tracer: false`.

Give maintained effects a stable `name` in `makeEffect({ name, on, backpressure,
handler })`. Names should describe the handler, without payload values or per-call
identifiers. Existing unnamed effects use their zero-based position in the plugin's
effect array; those labels change if that array is reordered.

## Span contract

| Invocation     | Span name                              | Attributes                                                                                                                                     |
| -------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Method         | `<plugin.type>.method.<method key>`    | `katakit.plugin.type`, `katakit.invocation.kind=method`, `katakit.method.name`                                                                 |
| Effect handler | `<plugin.type>.effect.<name or index>` | `katakit.plugin.type`, `katakit.invocation.kind=effect`, `katakit.effect.index`, `katakit.effect.backpressure`, optional `katakit.effect.name` |

All spans use the OpenTelemetry internal span kind. Successful returns retain
the default `UNSET` status. Synchronous throws and rejected promises set `ERROR`
and `error.type` (the error's name, or the JavaScript type of a non-Error failure).
Arguments, return values, configured options, transcript text, exception messages,
and stacks are not copied into spans.

Synchronous calls stay synchronous. A returned native Promise is returned unchanged
and its span ends on settlement. Other returned objects, including observables and
lazy thenables, end the method span on return; tracing does not subscribe to or
execute them. Callers still receive the original result or thrown/rejected value.
Effect failures retain the runtime's existing logging and backpressure behavior.

## What execution records establish

- A method span records a call through the runtime's cached method collection.
  Effects receive that same wrapped collection; dependency calls through
  `getMethods` are also traced. Direct calls through private closure references
  bypass that boundary.
- An effect span starts when its handler runs, after backpressure selection, and
  ends when the handler returns or its Promise settles. Queue waiting time is
  outside this span. Values coalesced or dropped by the scheduler have no handler
  span. Tracing does not repair or change scheduler behavior.
- An input's captured OpenTelemetry context connects a handler to its producer
  when the producer was traced. Independent external inputs can start separate
  traces. Replaying an old input does not reconstruct its original context.
- Returning without changing state remains a completed invocation. Core cannot
  infer a "declined" outcome, a skipped-trigger reason, emitted-event attribution,
  or an observable dependency graph.

Constructing a runtime or reading its observables does not start tracing work,
subscribe extra inspection streams, or run effects. Actual method calls made by
plugin initialization are still method invocations. Reading recorded spans never
replays application inputs. Trace retention, sampling, loss, and export durability
belong to the host SDK and exporter; they are not supplied by the persistence plugin.

See [Core](core.md) for methods and effects, and
[Runtime and lifecycle](../concepts/runtime.md) for ownership.
