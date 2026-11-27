# Changelog

## 0.2.0

- Every runtime now includes a replayable `EventLogPlugin`. New events receive `meta.seq` and `meta.timestamp`; `eventCount$` exposes the count. Core also supports observable inspection by React DevTools.
- **Breaking:** Import `EventLogPlugin` from `@katakit/core` and remove the separately configured `@katakit/event-log` plugin. Duplicate plugin types now throw. Validate events in the host before emission, and pass validated history with metadata to `makeKatakit({ existingEvents, plugins })`.
- **Breaking:** Rename the `concurrent` backpressure strategy to `none`. Handlers still run without waiting for earlier handlers to finish.

## 0.1.0

- Initial release of framework-independent, typed plugin composition, observables, methods, and effects.
- Provide reactive helpers including `eager`, `property`, `optionalProperty`, `evolve`, `collectReplay`, and `skipReplay`.
- Ship ESM, TypeScript declarations, and JavaScript/declaration source maps.
