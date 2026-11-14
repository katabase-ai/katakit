# Persistence plugin

`src/EventPersistencePlugin/plugin.ts` owns periodic append-only event persistence.
`src/LocalStorageEventPersistencePlugin/plugin.ts` specializes its callback for
browser local storage. `src/index.ts` is the public package entry point.

- Skip hydrated history; collect only events accepted after the persistence subscription starts.
- Restore a failed batch ahead of newer pending events without changing their order.
- Keep one per-runtime method collection and use `p-limit(1)` for write serialization.
- Hydration, storage identity, and uncertain-acknowledgement handling belong to the host/adapter.
- Periodic persistence currently owns a timer and subscription in its method collection.
  Do not claim that `kill()` disposes the subscription or rejects a failed final save.
- Keep browser storage and JSON handling in the local-storage specialization.
- Tests use workspace source exports and controlled promises rather than built artifacts or sleeps.
