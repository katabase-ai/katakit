# React developer tools

Optional, read-only inspection tools live at `@katakit/react/dev-tools`. The root
entry point does not load the tools. Import the compiled stylesheet separately:

```tsx
import { DevTools } from '@katakit/react/dev-tools';
import '@katakit/react/dev-tools.css';

<DevTools observables={{ transcript: transcript$, events: events$ }} />;
```

`DevTools` starts collapsed. Opening it subscribes to each named observable;
closing it releases those subscriptions. Each inspector shows the latest value,
up to 50 recent emissions (newest first), and waiting/live/complete/error status.
Replaying observables include their replayed emissions. Ordinary observables show
only values received while mounted; a source's optional `get()` supplies an
initial snapshot. Use existing shared/replaying observables: subscribing to a cold
observable can run its producer. The tools do not call plugin methods or edit data.

`ObservableInspector` is also available for a single source:

```tsx
import { ObservableInspector } from '@katakit/react/dev-tools';
import '@katakit/react/dev-tools.css';

<ObservableInspector name="Transcript" source={transcript$} />;
```

The exported `InspectionSource` type accepts an RxJS-compatible `subscribe`
method returning an object with `unsubscribe()`, and an optional `get()` method.
Each emission is serialized when received; circular references, bigint values,
and errors are handled. Displayed values are capped at 20,000 characters each.
Unmounting an inspector discards its history and subscriptions.

## Development-only rendering

Gate both loading and rendering on your bundler's development flag. With Vite:

```tsx
import { lazy, Suspense } from 'react';

const DevTools = import.meta.env.DEV
  ? lazy(async () => {
      const { DevTools } = await import('@katakit/react/dev-tools');
      await import('@katakit/react/dev-tools.css');
      return { default: DevTools };
    })
  : null;

export const App = () => (
  <>
    <YourApplication />
    {DevTools && (
      <Suspense fallback={null}>
        <DevTools observables={{ transcript: transcript$ }} />
      </Suspense>
    )}
  </>
);
```

Vite replaces `import.meta.env.DEV` with `false` in production and removes this
branch and its dynamic JavaScript/CSS imports. Other bundlers should use their
equivalent compile-time flag. The components themselves do not detect the build
mode: the application owns this choice. The transcription and browser bingo
examples use this pattern, including when mounted in the gallery.

## Styling and building

The package includes local adaptations of shadcn's Base UI variant and depends
on the published `@base-ui/react` primitives. It does not depend on the private
site UI package. See [third-party notices](./THIRD_PARTY_NOTICES.md).

`pnpm --filter @katakit/react build` builds the JavaScript and declarations, then
compiles and minifies scoped CSS with Lightning CSS into `dist/dev-tools.css`.
The published exports resolve entirely to `dist`. Consumers need React 19,
React DOM 19, and normal CSS import support; they do not need Tailwind, UnoCSS,
a component registry, or a theme configuration. Workspace `source` conditions
resolve to the authored components and plain CSS for development.
