# React integration

Use [React-RxJS](https://react-rxjs.org/docs/getting-started) to render runtime observables. Install `@react-rxjs/core`, `rxjs`, `react`, and `react-dom` in the application alongside `@katakit/core`.

Create the runtime and its bindings outside rendering. Call `bind(source$)` once per stable observable to obtain a hook and a shared stream. Place a `Subscribe` boundary around the components that call that hook, passing the **bound stream** as `source$`.

## Minimal example

This complete client entry point expects an HTML element with `id="root"`:

```tsx
import { createRoot } from 'react-dom/client';
import { bind, Subscribe } from '@react-rxjs/core';
import { BehaviorSubject } from 'rxjs';
import { makeKatakit, makeKatakitPlugin, property } from '@katakit/core';

const Counter = makeKatakitPlugin({
  type: 'Counter',
  configure: ({ initial }: { initial: number }) => ({ count: new BehaviorSubject(initial) }),
  observables: ({ options }) => ({ count$: property(options.count.asObservable()) }),
  methods: ({ options }) => ({
    increment: () => options.count.next(options.count.value + 1),
  }),
});
const running = makeKatakit({ plugins: [Counter.configure({ initial: 0 })] }).start();
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

The property observable replays its current value on subscription. The hook renders that value and updates when `increment()` emits a new one; calling `count$.get()` alone in a component would not subscribe it to changes. The [transcription demo](https://github.com/katabase-ai/katakit/blob/main/demos/transcription-react/src/App.tsx) binds `conversationTurns$`, `currentTurn$`, and `provisional$` separately. The latter two initially emit `undefined` until there is an unfinished turn or provisional text.

## Subscription ownership

[`Subscribe`](https://react-rxjs.org/docs/api/core/subscribe) establishes the bound subscription before rendering its children and releases it when the boundary unmounts. For example, `root.unmount()` removes the UI subscription; remounting a boundary subscribes again and reads the source's latest replayed value. Several views under one boundary can share the hook. Do not recreate the runtime or call `bind` on every render.

This cleanup covers React's subscriptions. It does not stop a runtime, release subscriptions created by core helpers, or dispose microphones, workers, or other host resources. Keep those resources under their existing host ownership; see [runtime and lifecycle](../concepts/runtime.md).

For a view that reads several bound streams, create a stable `combineLatest([firstState$, secondState$])` from RxJS and pass it to the boundary's `source$`. The bingo demos use this pattern for `lastHeard$` and the board; unlike the transcription demo, they do not display provisional text or bind the full turn list. The bingo plugin's runtime effect consumes transcription events independently of these React subscriptions.

For a source without a synchronous initial emission, [`bind`](https://react-rxjs.org/docs/api/core/bind) accepts a default value, or `Subscribe` can display a `fallback` while waiting. Choose an intentional initial UI. The example above uses a replaying property and needs neither a fabricated default nor custom Suspense handling.

`@katakit/react` is reserved for future React-specific APIs; use React-RxJS directly for observable subscriptions.
