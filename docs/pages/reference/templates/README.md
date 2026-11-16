# Templates

Templates are runnable starting points for building a Katakit application on a particular platform. A complete template assembles Katakit plugins and documents how to start, build, and deploy or package the application, along with its permissions, assets, storage, and lifecycle wiring. It is not a plugin package or a feature demo.

These starters have copyable build paths, but their platform verification differs:

- [React web](https://github.com/katabase-ai/katakit/tree/main/templates/react-web) runs a typed-text Katakit event log. The copied build, test, and browser-panel interaction passed on macOS; the browser engine/version was not reported, so broader browser support is unverified.
- [Electron desktop](https://github.com/katabase-ai/katakit/tree/main/templates/electron) runs a typed-note Katakit event log. The copied build and test passed, and the interaction was manually checked on macOS 15.6 with Electron 35.7.5; other desktop systems and installer packaging are unverified.
- [Chrome extension](https://github.com/katabase-ai/katakit/tree/main/templates/chrome-extension) runs a typed-text Katakit interaction, with optional audio capture. The copied build and test pass; loading the unpacked extension in Chrome has **not** been manually verified.
- [Obsidian desktop](https://github.com/katabase-ai/katakit/tree/main/templates/obsidian) runs supplied text through Katakit. The copied build and test pass; the plugin has **not** been manually run in Obsidian Desktop and must not be installed over an existing vault plugin.

The Chrome and Obsidian starters remain **provisional** until they run on their stated platforms. React has been exercised in a browser panel but lacks a reported browser version; Electron has been exercised on the specified macOS/Electron versions. The React transcription app remains a feature demo, not a general web starter. See the [template contributor guide](https://github.com/katabase-ai/katakit/blob/main/templates/README.md) for the copyable-directory convention and readiness checklist.

See [Templates and applications](../../concepts/templates.md) for the distinction and [Plugins](../plugins/README.md) for the reusable behavior an application can assemble.
