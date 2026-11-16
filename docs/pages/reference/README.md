# Reference

Reference is the catalog of Katakit's concrete building blocks: the core API, plugins, and platform-specific application starters. A plugin describes reusable behavior; a template shows how to build an application with that behavior on a particular platform.

These authored pages explain behavior, lifecycle, configuration, and examples. The
website also publishes a separate **API reference**, generated from public source
declarations and JSDoc, for individual symbols, signatures, and types. Both come
from the same Katakit revision. The local `pnpm -F @katakit/docs dev` viewer displays the
authored pages only.

- [Core](core.md): runtime construction, plugin composition, effects, and reactive helpers.
- [Developer workbench](developer-tools.md): inline React inspection, local capture, and controlled transcript input.
- [Tracing](tracing.md): OpenTelemetry setup and method/effect execution records.
- [Transcription utilities](transcription.md): standalone recognition, microphone capture, and WASM/worker setup.
- [Plugins](plugins/README.md): each plugin's inputs, outputs, options, and lifecycle.
- [Templates](templates/README.md): application starters and their current status, starting with a work-in-progress Chrome extension.

For the difference between plugins, applications, templates, and demos, see [Templates and applications](../concepts/templates.md). For a working first example, start with [Getting started](../getting-started/README.md).
