# Persistence plugin

Generic append-only event persistence. `src/plugin.ts` owns the adapter contract,
serialized flush loop, cursor, and automatic event-driven saves.

- The event log is authoritative. Keep pending events in its unsaved suffix, not a second queue.
- Advance the cursor only after the adapter acknowledges a complete batch.
- Automatic saves and public flushes share one per-runtime method collection and in-flight promise.
- Use `p-limit(1)` for write serialization; the in-flight promise only coalesces callers.
- Hydration and storage identity belong to the host; do not guess the durable prefix from log length.
- Adapters must handle same-position retries safely, including uncertain acknowledgements.
- Start no timers or storage work during observable/method construction.
- Do not add a database, serialization format, retry scheduler, or implicit shutdown guarantee.
- Tests use workspace source exports and controlled promises rather than built artifacts or sleeps.
