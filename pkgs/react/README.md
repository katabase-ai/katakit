# @katakit/react

Render `<KatakitDevTools />` from `@katakit/react` alongside your app in development.
See the [observable timeline guide](../../docs/pages/reference/react.md#observable-timeline).

When developing in the workspace, run `pnpm -F @katakit/react build` before
starting a consumer. UnoCSS compiles utilities directly from JSX `className`
attributes into the distributed bundle. Consumers need no styling plugin.

For observable subscriptions in a React application, use `@react-rxjs/core`.
The optional microphone lifecycle hook is available from `@katakit/transcription/react`
as `useMicrophoneTranscriber`.
