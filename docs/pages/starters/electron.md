# Build an Electron desktop app

The [Electron starter](https://github.com/katabase-ai/katakit/tree/main/templates/electron) shows how a local desktop renderer can use `@katakit/core` and `@katakit/event-log` without a development server. It validates a typed note, emits an event, and shows the note in the window. This is a small event-log application, not the richer notes-and-audio demo; it does not record, transcribe, or persist notes.

## Run and observe

Copy the complete `templates/electron/` directory and follow its [README](https://github.com/katabase-ai/katakit/blob/main/templates/electron/README.md) to install, build, and start Electron from the copy. **Add note** submits the prefilled sample; Enter submits another note. Spaces alone produce a validation message and leave the list unchanged. Closing and reopening the window resets the in-memory list. The build generates local files in `dist/`; it does not package an installer.

## Trace the desktop boundary

1. `electron/main.cjs` owns the native `BrowserWindow` and loads `dist/index.html`. It enables the renderer sandbox and context isolation, disables Node integration, and blocks new-window and navigation requests. There is no preload, IPC channel, or application network endpoint.
2. `src/kit.ts` defines a Valibot note schema and configures Katakit's event-log plugin. `emitEvent` is the renderer's input method and `events$` is the output stream. See [Event log](../reference/plugins/event-log.md) for validation and replay semantics.
3. `src/main.ts` maps the HTML form to the method and appends emitted text as DOM text, not HTML. It reports blank input next to the form and unsubscribes when the renderer closes. `index.html` and `src/style.css` hold the local UI.

First replace the event schema and form while leaving the sandbox intact. If your app later needs filesystem access, introduce a narrowly scoped preload/IPC interface instead of enabling Node in the renderer. If notes need to survive window close, choose and document storage explicitly; the current event log is memory-only. The copied directory bundles both Katakit packages, and its `pnpm-workspace.yaml` redirects the event-log package's core dependency to the same bundled version.

## Limits and verification

The interaction was manually exercised on macOS 15.6 with Electron 35.7.5, Node 24.14.1, and pnpm 11.9.0. A standalone copy installed, built, and passed its Katakit event test. Other operating systems, distributable app packaging, signing, and upgrades have not been tested. The app does not send note text off-device; installing Electron and other dependencies does contact package registries.
