# Persistence plugin

`src/EventPersistencePlugin/plugin.ts` owns periodic append-only event persistence.
`src/index.ts` is the public package entry point.

- Skip hydrated history; collect only events accepted after the persistence subscription starts.
- Restore a failed batch ahead of newer pending events without changing their order.
- Keep one per-runtime method collection and use `p-limit(1)` for write serialization.
- Hydration, storage identity, and uncertain-acknowledgement handling belong to the host/adapter.
- Periodic persistence currently owns a timer and subscription in its method collection.
  Do not claim that `kill()` disposes the subscription or rejects a failed final save.
- Browser storage and JSON decoding belong to the application.
- Tests use workspace source exports and controlled promises rather than built artifacts or sleeps.
