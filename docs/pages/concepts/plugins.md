# Plugins

A plugin declares a stable `type`, maps input options through `configure`, and can define observables, methods, and effects. `makeKatakitPlugin` supplies empty observables, methods, or effects when a part is omitted.

## Three parts

- **Observables** expose RxJS streams as properties with `$`-suffixed keys. A plugin may read another registered plugin's streams with `getObservables`.
- **Methods** expose callable operations and can access their own observables and other plugins' observables or methods.
- **Effects** subscribe to streams when the runtime starts. Each effect supplies an `on` observable, a handler, and a [backpressure strategy](../reference/core.md#makeeffect).

Dependencies are requested by plugin type rather than registration position. Both the dependency and its consumer must be in the runtime's `plugins` list. Circular construction dependencies are not a supported pattern.

Configuration can transform user-facing options into the options consumed by all three parts. A plugin's own observables and methods are reused within one runtime rather than reconstructed for each lookup.

For types and factory parameters, see [the core reference](../reference/core.md#makekatakitplugin). For concrete plugins and their options, see the [plugin catalog](../reference/plugins/README.md).
