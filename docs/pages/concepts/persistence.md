# Event-log persistence

The event-persistence plugin watches newly emitted event-log entries and appends them through a callback owned by the application. This page describes persisting events, not every kind of durable application data; applications can persist other data without an event log. The application chooses storage identity and loads event history **before** constructing its runtime. That loaded history becomes `initialEvents`; it is not appended again.

The plugin groups pending events on a timer (5 seconds by default) and serializes writes. Events arriving during a write remain pending for a later batch. If a write fails, its batch is placed ahead of newer events and retried on a later tick. Failures are logged rather than surfaced as a rejected `kill()` call.

An append callback must resolve only after the whole batch is durable. A failed or uncertain acknowledgement can lead to a repeated batch: Katakit does **not** provide exactly-once storage or deduplication. Design the adapter for that possibility.

Stop event producers before calling `await runtime.getMethods(PersistencePlugin).kill()` to stop the timer and request a final serialized flush. Completion does not prove durability if the callback failed, and the event subscription remains active. Core has no general disposal mechanism yet.

The included [browser local-storage adapter](../reference/plugins/persistence.md#makelocalstorageeventpersistenceplugin) appends a JSON array at a chosen key. It does not decode dates, validate loaded data, or coordinate concurrent tabs.
