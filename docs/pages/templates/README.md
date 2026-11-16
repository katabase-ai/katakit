# Build with templates

Start here when you want to copy a small Katakit application and replace one interaction with your own. Each directory under [`templates/`](https://github.com/katabase-ai/katakit/tree/main/templates) is a separate pnpm project, not part of the root workspace. Copy the **whole** directory, including `vendor/`, then follow its README. You do not need the Katakit repository to install the copy. Use Node.js 24+ and pnpm 11.9.0 unless the template README says otherwise.

These examples do one local operation with supplied or typed text: configure a plugin, start Katakit, call a method, and display an observable result. They do **not** provide AI replies, speech recognition, a backend, or durable storage. This keeps the first run free of a provider account or model download. The platform itself may require an installation step. If you only want to understand the API before starting an app, begin with [Getting started](../getting-started/README.md); for the distinction between plugins, applications, and demos, read [Templates and applications](../concepts/templates.md).

## Choose a platform

| Starter                                 | What you can change first                          | Manual platform evidence                                                                   |
| --------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [React web](react-web.md)               | Validated text events in a browser                 | Interaction checked in a browser panel; browser engine/version unknown                     |
| [Electron](electron.md)                 | A local desktop note event                         | Checked on macOS 15.6 with Electron 35.7.5; other OSes and installers unverified           |
| [Chrome extension](chrome-extension.md) | A text interaction in a side panel                 | **Provisional:** unpacked extension not yet run in Chrome                                  |
| [Obsidian](obsidian.md)                 | A supplied-text conversation turn in a plugin view | **Provisional:** not yet run in an Obsidian test vault                                     |
| [MCP App](mcp-app.md)                   | A Katakit-backed note card                         | **Provisional:** browser preview and MCP stdio tested; real chat-host rendering unverified |

## From copy to your application

1. **Copy and run.** Open the platform guide, then use the exact install, build, and run instructions in that template's README. The root `pnpm install` does not install these separate projects. A copied directory carries its own license, build files, and the Katakit tarballs it needs.
2. **Find the boundary.** Locate the file that configures Katakit and the file that maps a platform input to its method and observable. The guides below name both, and identify the platform host or entry point. Keep platform APIs out of reusable plugins.
3. **Replace one thing at a time.** Change the sample text or event schema first, then replace the input source and output view. Decide deliberately whether to add persistence, network calls, microphone access, or another dependency; none is implicit in these starters.
4. **Verify the actual platform.** Run the template's deterministic test and its documented manual interaction, including an empty-input failure and a reload or close. A copied build verifies packaging, not a Chrome extension, Obsidian view, or chat card. The status above reports what has actually been exercised.

## Why the copied projects contain tarballs

Katakit packages in this repository are version `0.0.0` and are not yet published to npm. Each template therefore includes the built Katakit packages it needs in `vendor/` and points `package.json` and, where needed, `pnpm-workspace.yaml` at those local artifacts. Ordinary libraries still install from the registry. When Katakit is published, replace the file dependencies with released versions. If you update package source before that, rebuild and inspect **all** affected tarballs from the same revision; the copied template README documents its artifacts. Do not treat a passing build against old tarballs as a test of newer workspace source.

The [contributor checklist](https://github.com/katabase-ai/katakit/blob/main/templates/README.md) defines what must ship in a copy and how to review a new template. For API contracts, use the [core and plugin reference](../reference/README.md); these guides explain the application wiring rather than duplicate the API reference.
