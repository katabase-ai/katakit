# Reference

Reference is the catalog of Katakit's concrete building blocks: the core API, plugins, and platform-specific application starters. A plugin describes reusable behavior; a template shows how to build an application with that behavior on a particular platform.

These authored pages explain behavior, lifecycle, configuration, and examples. The
separate **API reference** is generated from public source declarations and JSDoc
for individual symbols, signatures, and types. The local viewer, PR previews, and
consuming website include both. Each build uses one Katakit revision for both.

- [Core](core.md): runtime construction, plugin composition, effects, and reactive helpers.
- [Transcription utilities](transcription.md): standalone recognition, microphone capture, and WASM/worker setup.
- [Plugins](plugins/README.md): each plugin's inputs, outputs, options, and lifecycle.
- [Templates](templates/README.md): application starters and their current status, starting with a work-in-progress Chrome extension.

For the difference between plugins, applications, templates, and demos, see [Templates and applications](../concepts/templates.md). For a working first example, start with [Getting started](../getting-started/README.md).
