# Changelog

## 0.2.0

- Append full recorded events from core's built-in log. History supplied at startup is skipped.
- **Breaking:** Remove the `EventLogPlugin` factory argument. Replace `makeLocalStorageEventPersistencePlugin` with an application-owned `appendEvents` callback. Store events in order, including provisional events; validate stored history and restore `meta.timestamp` to a `Date` before hydration.

## 0.1.0

- Initial release of event-log persistence through application-supplied append callbacks.
- Batch and serialize writes, preserving failed batches ahead of newer events for retry.
- Provide a browser localStorage adapter; loading stored history remains application-owned.
