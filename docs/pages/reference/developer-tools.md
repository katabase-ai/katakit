# Developer workbench

The optional React workbench expands below the application in the same window.
It shows the running runtime's plugins, declared capabilities, observable values,
and locally captured execution. It starts collapsed; capture continues while
collapsed and while switching views.

## Views

- **Activity** shows method invocations, executed effect handlers, and observed
  emissions as timeline tracks and searchable records. Filter by plugin, kind,
  name, or track; turn off **Follow live** to hold the displayed record set while
  capture continues. Enable it again to see new records.
- **Details** shows a selected record's identity, timing, outcome, error type, and
  recorded parent/child links. Links use trace and span IDs, never timestamp
  proximity. An emission observed with an active span says **Observed in active
  span**; that does not establish a complete event-causality graph.
- **State & capabilities** shows current observable values with copy controls and
  waiting/live/complete/failed status. Methods and effects appear before their
  first invocation. Effect entries include their name or index and backpressure
  policy; trigger conditions cannot be inferred from an opaque stream.
- **Transcript & input** appears only when explicitly bound to a transcript
  ingestion plugin. It shows finalized/current turns and provisional text, accepts
  a finalized text segment with an optional speaker, and can finalize the current
  turn. Normal ingestion and downstream effects run. Optional microphone controls
  invoke the application's existing capture owner.

Method and effect records require the host SDK to send spans to the store.
Instrumentation can be enabled with no recording SDK; the UI distinguishes that
state from `tracer: false`. A completed call does not imply a state change.
Invocation arguments, results, transcript payloads, and exception messages are
not copied into spans. Observable values and transcript text are visible locally.

## Capture and SDK setup

Install the React package and a browser-compatible OpenTelemetry SDK in the host:

```sh
pnpm add @katakit/react @opentelemetry/api @opentelemetry/sdk-trace
```

Create one stable store for the runtime. The store's `spanProcessor` is an
OpenTelemetry processor; it needs `onStart` as well as `onEnd` to show running
calls. Add it when constructing the host's provider. Keep an existing provider
and its context manager rather than registering a second global SDK.

For a standalone browser development host, a dedicated setup module can contain:

```ts
// developerCapture.ts — import only in development, before starting the runtime
import { context, trace } from '@opentelemetry/api';
import { StackContextManager, TracerProvider } from '@opentelemetry/sdk-trace';
import { createDevToolsStore } from '@katakit/react/dev-tools';

export const store = createDevToolsStore({ capacity: 500, scopeName: 'example-runtime' });
const provider = new TracerProvider({ spanProcessors: [store.spanProcessor] });
context.setGlobalContextManager(new StackContextManager().enable());
trace.setGlobalTracerProvider(provider);
```

Use the same scope when constructing the runtime:

```ts
import { trace } from '@opentelemetry/api';
import { makeKatakit } from '@katakit/core';

const running = makeKatakit({
  plugins: [/* configured plugins */],
  tracer: trace.getTracer('example-runtime'),
}).start();
```

The optional `scopeName` filter isolates capture when one host runs multiple
runtimes. Give each runtime a distinct scope and store; one provider can own
several stores' processors. Without this filter the store accepts all method and
effect spans with the runtime's tracing attributes received by its processor.
Sampling and dropped spans affect what is available to inspect.

`StackContextManager` preserves synchronous context. Core carries input context
into queued effect handlers, but calls after native `await` need a host-supported
async context manager or explicit context handling. See [Tracing](tracing.md) for
the span contract and propagation limits.

## Development-only loading

Gate SDK setup, component loading, CSS loading, and rendering on the bundler's
compile-time development flag. For example, a Vite entry point can initialize
capture before rendering the application:

```tsx
const start = async () => {
  if (import.meta.env.DEV) await import('./developerCapture');
  // Render the application after development capture is ready.
  renderApplication();
};
void start();
```

In the React application, import types without loading the workbench, and lazy
load the optional code and stylesheet:

```tsx
import { lazy, Suspense } from 'react';
import type { AliveKatakit } from '@katakit/core';

const Workbench = import.meta.env.DEV
  ? lazy(async () => {
      const [{ DevTools }, { store }] = await Promise.all([
        import('@katakit/react/dev-tools'),
        import('./developerCapture'),
        import('@katakit/react/dev-tools.css'),
      ]);
      return {
        default: ({ runtime }: { runtime: AliveKatakit }) => (
          <DevTools runtime={runtime} store={store} />
        ),
      };
    })
  : null;

export const Application = ({ runtime }: { runtime: AliveKatakit }) => (
  <>
    <YourApplication />
    {Workbench && (
      <Suspense fallback={null}>
        <Workbench runtime={runtime} />
      </Suspense>
    )}
  </>
);
```

Vite removes the false production branch and its dynamic JavaScript/CSS imports.
Use the equivalent compile-time flag in other bundlers. The components do not
detect the build mode. The examples' production bundles exclude the workbench and
SDK setup.

## Transcript binding

Pass existing observables and methods from a configured transcript ingestion
plugin. No second ingestion runtime or microphone is created:

```tsx
<DevTools
  runtime={running}
  store={store}
  transcript={{
    observables: running.getObservables(TranscriptPlugin),
    methods: running.getMethods(TranscriptPlugin),
  }}
/>
```

To expose the application's microphone, supply `transcript.input` with `status`,
`recording`, optional `disabled`/`level` (0–1), and `onToggle`. The callback belongs
to the application and operates its existing session. Changing views, collapsing,
or clearing inspection history does not stop that session. Host lifecycle code
still owns microphone cleanup.

## Lifecycle and limits

`running.inspect()` enumerates already constructed plugins without invoking
factories or handlers again. It returns observable collections plus method and
effect metadata, without subscribing or attempting to reverse-engineer streams.

Mounting `DevTools` calls `store.connect(runtime)` to attach observable subscribers;
unmounting releases those subscribers. Keep one mounted workbench per store.
This subscription lifetime is independent of the open panel and selected view.
SDK span capture lasts as long as the host keeps the processor installed, even
before the React UI mounts. It does not retrospectively recover earlier emissions.
The workbench never starts or shuts down the runtime or host SDK.

Inspection adds subscribers to exposed observables. Use shared/replaying streams
when a cold producer must not run again. A source's optional `get()` provides an
initial current value; replayed emissions are observed at subscription time.
Serialized values are limited to 20,000 characters, with handling for circular
references, bigint, and errors.

The default history capacity is 500 invocation/emission records. Eviction drops
the oldest records and increments the displayed omitted count. Pending spans
that were cleared or evicted do not reappear when they finish. **Clear captured
history** clears these records and the omitted count; current observable values,
transcript turns, and application state remain intact. Invocation counts refer
only to retained records. Paused views still respect eviction and clear.

The store keeps its bounded history in memory and exports nothing over the
network. It supplies no durable trace storage or replay. Configure exporters,
retention, provider shutdown, and context-manager cleanup in the host. Transcript
history itself belongs to the application and is not limited by the inspection
record capacity.
