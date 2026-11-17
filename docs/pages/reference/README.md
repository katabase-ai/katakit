# Reference

Reference describes Katakit's reusable building blocks: the core API, plugins, transcription utilities, and [platform templates](../starters/README.md).

These authored pages explain behavior, lifecycle, configuration, and examples. The
website includes generated **API reference** beneath the corresponding package,
with individual symbols, signatures, and types from public declarations and JSDoc. Both come
from the same Katakit revision. The local `pnpm -F @katakit/docs dev` viewer displays the
authored pages only.

- [Core](core.md): runtime construction, plugin composition, effects, and reactive helpers.
- [Transcription utilities](transcription.md): standalone recognition, microphone capture, and WASM/worker setup.
- [Plugins](plugins/README.md): each plugin's inputs, outputs, options, and lifecycle.
- [Templates](../starters/README.md): runnable starting points for each supported platform.

For the difference between plugins, applications, templates, and demos, see [Templates and applications](../concepts/templates.md). For a working first example, start with [Getting started](../getting-started/README.md); for a copyable app, choose a [starter](../starters/README.md).
