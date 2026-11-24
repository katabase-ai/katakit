# Obsidian application starter

The [Obsidian starter](https://github.com/katabase-ai/katakit/tree/main/examples/starters/obsidian) is a desktop plugin that records a short microphone clip and transcribes it locally with Whisper Tiny English after **Stop**. Recognized text enters Katakit and appears as a completed conversation turn in a plugin view.

![Obsidian test vault with the Katakit transcription starter view open](/starters/obsidian.png)

The plugin view in an empty test vault, before recording.

`src/speech.ts` owns microphone permission, MediaRecorder capture, decoding, 16 kHz resampling, and single-thread inference. `src/session.ts` assembles Katakit and flushes recognized text into a turn. `src/main.ts` creates the Obsidian view, connects its controls and subscriptions, and releases resources when the view closes.

### Status and limitations

This starter is desktop-only; it does not stream provisional speech or write vault notes. The complete installed-plugin microphone-to-turn flow still needs verification in a test vault. See the [README's verification record](https://github.com/katabase-ai/katakit/blob/main/examples/starters/obsidian/README.md#verification) for the remaining scenarios.

## Get started

Follow the [starter README](https://github.com/katabase-ai/katakit/blob/main/examples/starters/obsidian/README.md#build-and-install-in-a-test-vault) for exact copy, build, and plugin-install commands. Use a new empty test vault. Enable the plugin and run **Open Katakit transcription starter** from the command palette. Choose **Record**, speak briefly, then choose **Stop** and wait for recognition. First use downloads the English model.

## Platform considerations

### Host and model assets

The plugin ID is `katakit-text-starter`; its installation directory and manifest must agree. Obsidian's renderer exposes a Node-like `process` but is not cross-origin isolated. `build.mjs` forces Transformers.js to select the browser ONNX backend and fails if the expected backend-selection code changes. Recheck asset loading and inference when upgrading that dependency or changing the build.

### Data and input lifetime

Audio and turns remain in memory and are not written to vault notes. Model downloads contact the provider, but recordings are not uploaded. The view owns the recorder, recognition session, and observable subscriptions. Closing it disposes the input, unsubscribes the view, and closes the session. Keep that lifecycle intact if moving the controls elsewhere in Obsidian.

## Make it yours

- **Change the input:** adapt `src/speech.ts`; a completed clip becomes finalized text before `src/session.ts` ingests it. Keep capture errors and track cleanup explicit.
- **Change application behavior:** configure plugins in `src/session.ts`; derive application content from events rather than another writable store.
- **Change the interface:** adapt the `ItemView` in `src/main.ts`, retaining close-time disposal and subscription cleanup.
- **Add persistence:** choose an explicit vault-writing or other storage workflow. The starter does not currently save notes; define the destination, retention, and restore behavior before adding that capability.

## Additional resources

- [Obsidian plugin development](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin) — plugin setup and the host development workflow.
- [Obsidian API reference](https://docs.obsidian.md/Reference/TypeScript+API) — APIs for views, commands, and vault integration.
- [Submit an Obsidian plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin) — requirements for distributing a community plugin.
