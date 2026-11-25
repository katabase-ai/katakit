# @katakit/react

Render a caller-owned timeline without capture:

```tsx
import { Timeline } from '@katakit/react';
import '@katakit/react/timeline.css';

<Timeline
  lanes={[{ id: 'jobs', label: 'Jobs' }]}
  events={[{ id: 'job-1', laneId: 'jobs', time: 1000 }]}
  selectedId={selectedId}
  onSelect={setSelectedId}
/>;
```

See the [public timeline guide](../../docs/pages/reference/react.md#data-driven-timeline).

Render `<KatakitDevTools />` from `@katakit/react` alongside your app in development.
See the [observable timeline guide](../../docs/pages/reference/react.md#observable-timeline).

When developing in the workspace, run `pnpm -F @katakit/react build` before
starting a consumer. UnoCSS compiles utilities directly from JSX `className`
attributes into the distributed bundle. Consumers need no styling plugin.

For observable subscriptions in a React application, use `@react-rxjs/core`.
The optional microphone lifecycle hook is available from `@katakit/transcription/react`
as `useMicrophoneTranscriber`.
