# React-specific APIs

The `dev-tools` entry point owns the observable timeline.

- Applications use `@react-rxjs/core` for observable subscriptions today; this is an
  existing third-party binding, not an API exported by `@katakit/react`. Do not add a competing subscription hook.
  See the [React-RxJS integration guide](../../docs/pages/reference/react.md#react-rxjs-bindings).
- The home for DevTools is this package. Keep their UI components
  internal to DevTools rather than exposing a public design system or duplicating them
  into examples.
- DevTools should render only in development by default and ship compiled CSS
  without requiring a consumer Tailwind/UnoCSS setup. Verify production exclusion and
  CSS isolation in a consuming application before claiming either behavior.
- Do not build a component registry or extensibility platform as an incidental cleanup.
