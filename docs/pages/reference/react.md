# @katakit/react

`@katakit/react/dev-tools` provides a browser timeline for inspecting observable deliveries.
Applications render their own runtime state with [React-RxJS bindings](#react-rxjs-bindings).

## Observable timeline

Open the panel in the development entry point **before creating the runtime**:

```ts
if (import.meta.env.DEV) {
  const { openKatakitDevtools } = await import('@katakit/react/dev-tools');
  const close = openKatakitDevtools();
  import.meta.hot?.dispose(close);
}
```

Expand **Katakit devtools** and hover, tap, or keyboard-focus a dot. Each lane is
a named observable in one runtime. Each dot is one `next` delivery to an existing
subscriber; two subscribers get two dots. The panel does not subscribe to sources.
Subscriptions made inside a plugin before it returns its observables are not observed.

**Stack at delivery** shows application frames first, with the full stack one click
away. Same-origin source maps are resolved on inspection. For replayed values the
stack may show the subscription; for scheduled work it may show the scheduler.
The panel keeps the last 500 deliveries, even while collapsed. Object previews
read current fields. Call `close()` to stop recording without stopping the runtime.

## Developer workbench

**Workbench availability — November 17, 2026:** [PR #27](https://github.com/katabase-ai/katakit/pull/27)
implemented the workbench and merged into the tracing branch. Its parent
[PR #38](https://github.com/katabase-ai/katakit/pull/38) has not merged into `main`.
The richer workbench examples in this section require that branch's Core and React
packages. They are separate from the observable timeline above.

The workbench starts collapsed below the application. Capture continues while it is collapsed
or showing another view. It provides:

- **Activity:** method calls, effect handlers, and observable emissions in searchable timeline
  tracks. Calls show running, returned, or failed outcomes. **Follow live** controls whether the
  view follows new records; capture continues when it is off.
- **Details:** a selected record's timing, outcome, error type, and recorded parent/child spans.
  Relationships use trace and span IDs. An emission observed within an active span is not proof
  of a complete causal relationship.
- **State & capabilities:** current observable values, copy controls, and waiting/live/complete/failed
  status. Declared methods and effects appear before their first invocation. Effect metadata
  includes its name or index and backpressure policy, not inferred trigger conditions.
- **Transcript & input:** an optional view of conversation turns and provisional text. It can
  submit a finalized text segment or finalize the current turn through the application's real
  ingestion methods. Optional microphone controls call the application's existing capture owner.

### Capture setup

The workbench uses one stable capture store per runtime. Observable inspection works through
subscriptions; method and effect timelines additionally need an OpenTelemetry SDK connected to
the store's `spanProcessor`.

In a development-only setup module, configure capture before starting the runtime:

```ts
// developerCapture.ts
import { context, trace } from '@opentelemetry/api';
import { StackContextManager, TracerProvider } from '@opentelemetry/sdk-trace';
import { createDevToolsStore } from '@katakit/react/dev-tools';

export const store = createDevToolsStore({ capacity: 500, scopeName: 'example-runtime' });
const provider = new TracerProvider({ spanProcessors: [store.spanProcessor] });
context.setGlobalContextManager(new StackContextManager().enable());
trace.setGlobalTracerProvider(provider);
```

This setup assumes the host has no existing SDK. If it has one, add the processor to that
provider instead of registering another global provider. The processor needs both `onStart`
and `onEnd` to show running and finished calls. Match the store's optional scope filter when
creating the runtime:

```ts
import { trace } from '@opentelemetry/api';
import { makeKatakit } from '@katakit/core';

const running = makeKatakit({
  plugins: [/* your configured plugins */],
  tracer: trace.getTracer('example-runtime'),
}).start();
```

`StackContextManager` preserves synchronous context. Calls after native `await` need a
host-supported async context manager or explicit context handling. Sampling and dropped spans
limit the recorded timeline. The branch's [tracing guide][tracing-guide] describes those limits.

### Render in development

Load `developerCapture.ts` behind the bundler's compile-time development flag before starting
the runtime. Gate component and CSS loading too; `DevTools` does not detect the build mode.
For Vite, the workbench component can be loaded lazily:

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

export const DeveloperPanel = ({ runtime }: { runtime: AliveKatakit }) =>
  Workbench ? (
    <Suspense fallback={null}>
      <Workbench runtime={runtime} />
    </Suspense>
  ) : null;
```

Render `DeveloperPanel` beside the application with its existing started runtime. The package
ships compiled, scoped CSS; the host does not need Tailwind or UnoCSS. React 19 and React DOM 19
are required even when the application uses the DOM mounting API below.

### Transcript and microphone controls

Pass an existing configured transcript-ingestion plugin's observables and methods to `DevTools`:

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

The optional `transcript.input` object accepts `status`, `recording`, `onToggle`, and optional
`disabled` and `level` (0–1). Its callback operates the application's existing microphone.
Submitting a segment runs normal turn grouping and downstream effects. Clearing inspection
history does not clear transcript turns or stop capture.

### DOM mounting and popout

A host without a React component tree can mount the same workbench into an existing DOM element:

```ts
import { mountDevTools } from '@katakit/react/dev-tools/mount';
import '@katakit/react/dev-tools.css';

// `running` and `store` are the host-owned runtime and capture store configured above.
const workbench = mountDevTools(container, { runtime: running, store });

// From a user gesture:
popoutButton.addEventListener('click', () => workbench.popOut());
dockButton.addEventListener('click', () => workbench.dock());

// When the host view closes:
workbench.unmount();
```

`mountDevTools` creates its own React root and preserves existing container children. One mount
is allowed per container. Call `unmount()` during the host's view teardown; removing the DOM
element alone does not release inspection subscriptions. The handle also provides:

- `update({ transcript, popout })`: update bindings or window options while keeping the runtime
  and store fixed. Omitted options remain unchanged; `transcript: undefined` removes that view.
- `popOut()`: open or focus a same-origin, script-accessible child window. Returns `false` when
  disabled, blocked, or unavailable. Call it synchronously from a user gesture.
- `dock()`: return the workbench to its original container. Repeated calls are safe.
- `unmount()`: release the owned React root and inspection subscriptions and close its popout.
  Repeated calls are safe; the host's runtime, microphone, SDK, and store history remain intact.

The **Pop out workbench** and **Dock workbench** buttons provide the same behavior in React.
The existing panel moves between documents with its selected view, filters, and input drafts.
Closing the child window docks it again. The host's styles are copied into the child window;
import the compiled CSS in the host. A blocked popup leaves the inline panel usable.

Both APIs accept `popout: false` to hide the controls. For host-owned window creation, supply
`popout.openWindow`, a synchronous callback that receives the source `Window` and returns a new
blank `Window` or `null`. A native window reachable only through IPC cannot be used by this API. Electron and
Obsidian hosts need the runtime in the same JavaScript context as the mounted panel; see the
branch's [Electron and Obsidian examples][workbench-guide].

### Capture ownership and retention

Mounting `DevTools` connects the store to the runtime's exposed observables. Unmounting removes
those subscribers. Keep one mounted workbench per store and use shared/replaying streams when
an additional subscriber must not rerun a cold producer. SDK span capture lasts as long as the
host keeps the processor installed, including before the panel mounts. Earlier emissions cannot
be recovered retrospectively.

The default history retains 500 invocation/emission records in memory. Eviction removes the
oldest records and reports an omitted count. **Clear captured history** clears those records
and that count; current values and application state remain intact. Pending spans that were
cleared or evicted do not return when they finish.

The store sends nothing over the network and provides no durable storage or replay. The host
owns exporters, provider shutdown, and microphone cleanup. Observable values and transcript text
are visible locally. Invocation arguments, results, transcript payloads, and exception messages
are not copied into spans.

## React-RxJS bindings

Use [React-RxJS](https://react-rxjs.org/docs/getting-started) to render runtime observables. Install `@react-rxjs/core`, `rxjs`, `react`, and `react-dom` in the application alongside its Katakit packages. The example below also uses `@katakit/event-log` and `valibot`.

`@react-rxjs/core` supplies the `bind` and `Subscribe` APIs used below; it is an external
library, not a subpath or feature of `@katakit/react`. Applications do not need to install
`@katakit/react` for observable bindings.

Create the runtime and its bindings outside rendering. Call `bind(source$)` once per stable observable to obtain a hook and a shared stream. Place a `Subscribe` boundary around the components that call that hook, passing the **bound stream** as `source$`.

### Minimal example

This complete client entry point expects an HTML element with `id="root"`:

```tsx
import { createRoot } from 'react-dom/client';
import { bind, Subscribe } from '@react-rxjs/core';
import { scan, shareReplay, startWith } from 'rxjs';
import { makeKatakit, makeKatakitPlugin, property } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import * as v from 'valibot';

const EventLog = makeEventLogPlugin({
  validateEvent: v.strictObject({ type: v.literal('increment') }),
});
const Counter = makeKatakitPlugin({
  type: 'Counter',
  configure: (options: {}) => options,
  observables: ({ getObservables }) => ({
    count$: property(
      getObservables(EventLog).events$.pipe(
        scan(count => count + 1, 0),
        startWith(0),
        shareReplay({ bufferSize: 1, refCount: true })
      )
    ),
  }),
  methods: ({ getMethods }) => ({
    increment: () => getMethods(EventLog).emitEvent({ type: 'increment' }),
  }),
});
const running = makeKatakit({
  plugins: [EventLog.configure({ initialEvents: [] }), Counter.configure({})],
}).start();
const { count$ } = running.getObservables(Counter);
const { increment } = running.getMethods(Counter);
const [useCount, countState$] = bind(count$);

const CounterView = () => {
  const count = useCount();
  return <button onClick={increment}>Count: {count}</button>;
};

const root = createRoot(document.getElementById('root')!);
root.render(
  <Subscribe source$={countState$}>
    <CounterView />
  </Subscribe>
);
```

`shareReplay` supplies the current count to new subscribers. The hook renders that value
and updates when `increment()` records another event; calling `count$.get()` alone in a component
would not subscribe it to changes. The
[transcription view](https://github.com/katabase-ai/katakit/blob/main/examples/demos/transcription-react/src/TranscriptionDemo.tsx)
renders conversation state from a runtime owned by its host. `currentTurn$` and `provisional$`
initially emit `undefined` until there is an unfinished turn or provisional text.

### Subscription ownership

[`Subscribe`](https://react-rxjs.org/docs/api/core/subscribe) establishes the bound subscription before rendering its children and releases it when the boundary unmounts. For example, `root.unmount()` removes the UI subscription; remounting a boundary subscribes again and reads the source's latest replayed value. Several views under one boundary can share the hook. Do not recreate the runtime or call `bind` on every render.

This cleanup covers React's subscriptions. It does not stop a runtime, release subscriptions created by core helpers, or dispose microphones, workers, or other application resources. Keep those resources under application control; see [ownership and shutdown](core.md#ownership-and-shutdown).

For a view that reads several bound streams, create a stable
`combineLatest([firstState$, secondState$])` from RxJS and pass it to the boundary's `source$`.
The [browser bingo runtime](https://github.com/katabase-ai/katakit/blob/main/examples/demos/bingo-react/src/createBrowserBingoDemo.ts)
also demonstrates combining transcript and board state into one view stream. Its synchronous
transcript bridge owns a separate subscription and releases it when the runtime closes.

For a source without a synchronous initial emission, [`bind`](https://react-rxjs.org/docs/api/core/bind) accepts a default value, or `Subscribe` can display a `fallback` while waiting. Choose an intentional initial UI. The example above uses a replaying property and needs neither a fabricated default nor custom Suspense handling.

## Connect microphone input

For component-owned capture, `useMicrophoneTranscriber` from `@katakit/transcription/react`
owns a microphone transcriber and the sink receiving its results. Pass a stable `createSink`
factory. The hook drains capture before closing that sink on unmount, and exposes recording
state, audio level, and a toggle for user actions. See the [transcription guide](transcription.md)
and [package example](https://github.com/katabase-ai/katakit/blob/main/pkgs/transcription/README.md#react).

This hook manages microphone ownership; React-RxJS manages subscriptions to runtime observables.
The [React web starter](../starters/react-web.md) shows the complete input-to-view setup.
Use `@react-rxjs/core` for subscriptions and `@katakit/transcription/react` for optional
microphone ownership. Neither requires `@katakit/react`.

[workbench-guide]: https://github.com/katabase-ai/katakit/blob/2db9d56534c719f5aaf17698a6756e30cf183cde/docs/pages/reference/developer-tools.md
[tracing-guide]: https://github.com/katabase-ai/katakit/blob/2db9d56534c719f5aaf17698a6756e30cf183cde/docs/pages/reference/tracing.md
