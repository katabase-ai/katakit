# Reference

Reference describes Katakit's reusable building blocks: the core API, plugins, and transcription utilities. For platform-specific application starters, use [Build with templates](../templates/README.md).

These authored pages explain behavior, lifecycle, configuration, and examples. The
website also publishes a separate **API reference**, generated from public source
declarations and JSDoc, for individual symbols, signatures, and types. Both come
from the same Katakit revision. The local `pnpm -F @katakit/docs dev` viewer displays the
authored pages only.

- [Core](core.md): runtime construction, plugin composition, effects, and reactive helpers.
- [Transcription utilities](transcription.md): standalone recognition, microphone capture, and WASM/worker setup.
- [Plugins](plugins/README.md): each plugin's inputs, outputs, options, and lifecycle.

For the difference between plugins, applications, templates, and demos, see [Templates and applications](../concepts/templates.md). For a working first example, start with [Getting started](../getting-started/README.md); for a copyable app, choose a [template](../templates/README.md).
