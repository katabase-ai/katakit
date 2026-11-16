# React developer tools

The optional `@katakit/react/dev-tools` entry point provides an inline developer
workbench for a started runtime: activity timeline, observable values, declared
methods and effects, and optional transcript input. The root entry point does not
load the workbench.

```tsx
import { DevTools, createDevToolsStore } from '@katakit/react/dev-tools';
import '@katakit/react/dev-tools.css';

// Keep this host-owned store stable across renders. Register its spanProcessor
// with the host's OpenTelemetry SDK to capture method and effect invocations.
const store = createDevToolsStore();

<DevTools runtime={running} store={store} />;
```

See the [developer workbench guide](../../docs/pages/reference/developer-tools.md)
for SDK setup, development-only loading, transcript bindings, capture lifecycle,
and retention limits. Both browser examples use the package in development.

The published package includes JavaScript, TypeScript declarations, and compiled,
scoped CSS. Consumers need React 19, React DOM 19, and normal CSS import support;
no Tailwind, UnoCSS, component registry, or theme configuration is required.

Components are local adaptations of shadcn's Base UI variant, backed by the
published `@base-ui/react` primitives. See [third-party notices](./THIRD_PARTY_NOTICES.md).
`pnpm --filter @katakit/react build` builds JavaScript and declarations and
compiles/minifies the stylesheet with Lightning CSS. Published exports resolve
to `dist`; workspace `source` conditions resolve to authored source and CSS.
