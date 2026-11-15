# Event history

`@katakit/event-log` provides a plugin with a replayable `events$` stream and an `emitEvent` method. Configure it with `initialEvents` to restore history before the runtime starts. New subscribers receive that history and then subsequent events in order; `events$.getAll()` returns a copy of the recorded array.

`emitEvent` validates each new event synchronously against the supplied Standard Schema. Invalid input throws without adding an event. If the schema transforms a value, the validated output—not the caller's original input—is published. Async validation is unsupported.

**Loaded `initialEvents` are not validated by the event-log plugin.** The application must ensure stored data is compatible with the current event schema before handing it to the plugin.

The event log is in-memory; it does not load or write storage on its own. See [persistence](persistence.md) for writes and the [event-log plugin](../reference/plugins/event-log.md) for configuration.
