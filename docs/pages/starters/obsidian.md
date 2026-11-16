# Build an Obsidian plugin

The [Obsidian starter](https://github.com/katabase-ai/katakit/tree/main/templates/obsidian) is a desktop plugin that turns supplied text into a Katakit conversation turn with `@katakit/core` and `@katakit/transcript-ingestion`. It is **not** a speech recognizer: there is no microphone, model download, cloud service, or automatic note writing. The text exists only while the plugin view is open.

## Run safely in a test vault

Copy the complete `templates/obsidian/` directory and follow its [README](https://github.com/katabase-ai/katakit/blob/main/templates/obsidian/README.md) to install, build, and test it. Create a **new empty test vault**, not an existing personal vault. Copy `dist/main.js` and `dist/manifest.json` into that vault's `.obsidian/plugins/katakit-text-starter/`, enable the community plugin, then run **Open Katakit text starter** from the command palette. Add the supplied line, add a second line, try whitespace alone, and close/reopen the view to check that turns were discarded. These are steps to verify, **not a report that the Obsidian UI has already passed**.

## Trace the plugin boundary

1. `src/session.ts` configures and starts transcript ingestion inside Katakit. `submit` passes a text segment with an ID and source ID to `ingestSegment`, then calls `flush` to complete a turn. This plugin assembles text; it does not recognize speech. See [Transcript ingestion](../reference/plugins/transcript-ingestion.md) for segment and turn behavior.
2. `src/main.ts` registers an Obsidian `ItemView` and command, connects the textarea to `submit`, and renders `conversationTurns$` into the view. On close it unsubscribes and closes the session. Nothing is written to the vault.
3. `build.mjs` bundles the plugin as Obsidian's CommonJS `main.js` and copies the manifest. Only `dist/` files go into the test vault; `vendor/` and `node_modules/` are build-time dependencies.

To adapt this, first replace the textarea with another **text** source, preserving segment IDs, flush behavior, and view cleanup. Adding microphone capture, model inference, or vault persistence is separate work with different permissions and retention expectations. Do not install this starter over the existing transcription prototype; it uses a distinct plugin ID. It supports desktop only.

## Limits and verification

**Provisional.** The standalone copy installed, built, and passed the transcript-ingestion interaction test; no fresh test-vault run was performed. Obsidian Desktop 1.8.4 was installed but an existing personal vault was open, so no plugin was installed there. A build does not show that the command, view, or Obsidian lifecycle works. Verify in a disposable vault before calling the platform path ready.
