# React-specific APIs

This package is currently a buildable placeholder. Do not document or import DevTools
until they exist.

- Applications use `@react-rxjs/core` for observable subscriptions today; this is an
  existing third-party binding, not an API exported by `@katakit/react`. Keep the
  placeholder for future Katakit-specific React APIs, not a competing subscription hook.
  See the [React integration guide](../../docs/pages/getting-started/react.md).
- The agreed home for future DevTools is this package. Keep their richer UI components
  internal to DevTools rather than exposing a public design system or duplicating them
  into examples.
- Future DevTools should render only in development by default and ship compiled CSS
  without requiring a consumer Tailwind/UnoCSS setup. Verify production exclusion and
  CSS isolation in a consuming application before claiming either behavior.
- Do not build a component registry or extensibility platform as an incidental cleanup.
