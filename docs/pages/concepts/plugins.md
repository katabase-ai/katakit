# Plugins

A plugin declares a stable `type`, maps input options through `configure`, and can define observables, methods, and effects. `makeKatakitPlugin` supplies empty observables, methods, or effects when a part is omitted.

## Three parts

- **Observables** expose RxJS streams as properties with `$`-suffixed keys. A plugin may read another registered plugin's streams with `getObservables`.
- **Methods** expose callable operations and can access their own observables and other plugins' observables or methods.
- **Effects** subscribe to streams when the runtime starts. Each effect supplies an `on` observable, a handler, and a [backpressure strategy](../reference/core.md#makeeffect).

Dependencies are requested by plugin type rather than registration position. Both the dependency and its consumer must be in the runtime's `plugins` list.

Methods are created on demand. Once created, methods from different plugins can call each other, even in both directions. Calling `getMethods` inside a plugin's `methods` callback also starts constructing the requested plugin's methods. If those methods call back into the first plugin before its callback finishes, construction can crash because of recursive loops. To avoid this, do not make mutually dependent `getMethods` calls inside `methods` callbacks; look up the other plugin when a returned method is called instead.

Configuration can transform user-facing options into the options consumed by all three parts. A plugin's own observables and methods are reused within one runtime rather than reconstructed for each lookup.

For types and factory parameters, see [the core reference](../reference/core.md#makekatakitplugin). For concrete plugins and their options, see the [plugin catalog](../reference/plugins/README.md).

## Calling a model from an effect

The [structured notes example](https://github.com/katabase-ai/katakit/tree/main/examples/demos/notes-react)
observes finalized conversation turns and sends a structured-output request through a host-supplied
connection. The host owns admission and transport; the plugin owns its prompt and validation.
The event log records finalized turns, accepted outlines with stable IDs and cursors, and clears.
The plugin derives its outline and Markdown from those events. Replay restores content without
calling a model. Connection and retry state stay transient.

Its `latest` effect finishes the current request before handling the newest pending signal. The
plugin reads accumulated turns from its processed cursor, so it retains turns received in flight.
It advances that cursor only after validated output. Clear and close abort the request and discard
late results. The example closes its own effect stream because the core runtime has no general stop method.
