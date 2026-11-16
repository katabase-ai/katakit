# Core

Import public symbols from `@katakit/core`. These contracts describe the current runtime; they do not imply a general shutdown or duplicate-type validation API.

## makeKatakit

`makeKatakit({ plugins })` accepts an array of **configured** plugins. Its return value provides `getObservables(plugin)` and `start()`. `start()` may be called once; it returns `getObservables(plugin)` and `getMethods(plugin)` and subscribes effects. Both lookup functions accept a plugin factory or configured value and throw when no matching type is registered.

The optional `tracer` accepts an OpenTelemetry `Tracer`, or `false` to disable
instrumentation for this runtime. By default it uses the global tracer named
`@katakit/core`, which produces no telemetry until a host registers an SDK. See
[Tracing](tracing.md) for setup and recorded execution boundaries.

## makeKatakitPlugin

`makeKatakitPlugin({ type, configure, observables?, methods?, effects? })` creates a plugin factory. `configure(inputOptions)` produces the configured plugin added to `makeKatakit({ plugins })`. The `configure` callback transforms input options into options received by the other callbacks.

`observables` receives `{ options, getObservables }`; `methods` additionally receives its own `observables` and `getMethods`; `effects` receives its own `observables`, `methods`, and both lookup functions. Omitted callbacks produce empty collections. Observable keys end in `$`; methods are functions.

## makeEffect

`makeEffect({ name?, on, backpressure, handler })` creates an effect. `name` is an
optional stable label for tracing. `on` is an RxJS observable;
`handler(value)` may be synchronous or asynchronous. `backpressure` must be one of:

- `queue`: handle every value in arrival order, one at a time.
- `latest`: while busy, keep only the latest pending value.
- `concurrent`: start a handler for each value without waiting for prior handlers.

Handlers' errors are logged; they are not propagated to the caller of `start()`.

## Reactive helpers

| Export                         | Current behavior                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `eager(observable)`            | Subscribes immediately; adds `getAll()` to return a snapshot of values observed so far. |
| `property(observable)`         | Adds `get()` for the latest value and requires a synchronous initial emission.          |
| `optionalProperty(observable)` | Adds `get()` for the latest value or `undefined` before the first emission.             |
| `evolve(reducer, seed)`        | Folds source values into accumulated outputs; the seed itself is not emitted.           |
| `skipReplay()`                 | Skips values delivered synchronously during subscription, including replayed values.    |
| `collectReplay(observable)`    | Returns an array of values delivered synchronously during a subscription.               |

Core also exports types for plugin configuration, observable and method lookup, effects, and backpressure. See [runtime and lifecycle](../concepts/runtime.md) for the ownership model.
