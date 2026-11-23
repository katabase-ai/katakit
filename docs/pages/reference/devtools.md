# @katakit/devtools

In a browser development entry point, open the panel before creating your runtime:

```ts
if (import.meta.env.DEV) {
  const { openKatakitDevtools } = await import('@katakit/devtools');
  const close = openKatakitDevtools();
  import.meta.hot?.dispose(close); // Vite: stop recording on module disposal
}
```

Expand **Katakit devtools** and hover, tap, or keyboard-focus a dot. Each lane is
a named plugin observable in one runtime. Each dot is a `next` delivery through
that named observable to one subscriber; two subscribers mean two dots. Sources
with no subscribers are not executed. Subscriptions created inside a plugin
before it returns its observables are outside this boundary.

**Stack at delivery** shows where the value reached that subscriber. Replay can
therefore show subscription code, and scheduled work can show a scheduler rather
than the original producer. Every dot captures the available stack. Application frames
appear first, with the full stack one click away. Accessible same-origin source
maps are resolved on inspection; otherwise the generated locations remain visible.

The panel keeps the latest 500 deliveries for the page, including while collapsed.
Object previews show a few current fields, not a historical deep copy. Call the
returned cleanup function when the host is done; it does not stop the runtime.
