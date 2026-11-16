# Runtime and lifecycle

`makeKatakit({ plugins })` constructs a runtime from configured plugins. A plugin factory defines a type and configuration behavior; `plugin.configure(options)` produces the value registered in `plugins`.

## Before and after start

The constructed runtime exposes `getObservables(plugin)`. Observable collections are created when first requested and reused within that runtime. This path does not start methods or subscribe effects.

Call `start()` once to get `getMethods(plugin)` as well. Starting initializes each plugin's effects and their subscriptions. Method collections are also cached per runtime. Calling `start()` a second time throws.

Lookups accept either a plugin factory or its configured value, matching the registered plugin by its `type` string. A missing type throws. Register distinct plugin types: the current implementation looks up the first matching type and does **not** reject duplicates.

## Ownership and shutdown

Each runtime has separate observable and method instances, even when constructed with the same configured plugin. Plugins can own timers or subscriptions; core currently has no general disposal lifecycle. The [persistence plugin](persistence.md) supplies a `kill()` method for its timer and final flush, but it does not dispose its event subscription.

The host also owns any OpenTelemetry SDK, context manager, exporter, and exporter
shutdown. [Tracing](../reference/tracing.md) observes method and effect execution;
it does not change runtime ownership or add records to application event logs.

See the [core API](../reference/core.md) and [plugin model](plugins.md).
