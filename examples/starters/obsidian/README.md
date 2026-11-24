# Obsidian desktop transcription starter

Record a short microphone clip in an Obsidian view, transcribe it locally with Whisper Tiny English, and send recognized text into Katakit's transcript-ingestion plugin. A completed turn appears in the view. Recognition occurs **after Stop**, not continuously. The first use downloads model weights from `Xenova/whisper-tiny.en`; an internet connection and OS microphone permission are needed. Audio and text stay in memory, are not written to vault notes, and disappear when the view closes.

## Build and install in a test vault

Copy the entire `examples/starters/obsidian/` directory. With Node.js 24+ and pnpm 11.9.0, run `pnpm install`, `pnpm build`, and `pnpm test` inside that copy. Create a **new, empty test vault**, not a personal vault or one containing another Katakit plugin. In `.obsidian/plugins/katakit-text-starter/`, copy the build's `dist/main.js` and `dist/manifest.json`. In Obsidian Desktop, enable community plugins and **Katakit Text Starter**, then run **Open Katakit transcription starter** in the command palette. Click **Record**, speak briefly, then **Stop** and wait for the turn. The plugin ID and directory must match. Restart Obsidian if a new plugin does not appear. Mobile is unsupported.

`src/speech.ts` captures a short MediaRecorder clip, decodes and resamples to 16 kHz, and uses single-thread Whisper inference. Obsidian's renderer is not cross-origin isolated; `build.mjs` forces Transformers.js to choose its browser ONNX backend despite Obsidian's Node-like `process`. The build fails if that backend selection code changes. `src/session.ts` assembles Katakit and flushes recognized text into a turn; `src/main.ts` owns the Obsidian view, status and cleanup. npm dependency installation and first model download contact external registries/providers; the plugin does not upload recorded audio.

## Verification

The copied build, deterministic Katakit segment test, and mocked recorder-error cleanup test pass; none proves the complete microphone-to-turn flow in an installed Obsidian plugin. **The complete interaction still needs a manual test-vault run.** Record the Obsidian and OS versions alongside results for first download, microphone recognition, OS permission denial, short/empty audio, a second recording, and close/reopen. Opening the plugin view alone does not verify recording or inference. Mobile is unsupported.

For shared APIs, see [Transcript ingestion](https://github.com/katabase-ai/katakit/tree/main/docs/pages/reference/plugins).

### Screenshot provenance

`docs/public/starters/obsidian.png` was captured on 2026-11-24 from a standalone copy of source revision `37af0d7`, installed against npm dependencies. Obsidian 1.8.4 on macOS 15.6 loaded the built plugin in an isolated application profile and a new empty test vault. Community plugins were enabled for that vault and the starter command opened its real view. Playwright captured the idle view without injecting a transcript, recording audio, or running inference. Plugin loading and view rendering passed; the complete microphone-to-turn flow and remaining scenarios above are still unverified.
