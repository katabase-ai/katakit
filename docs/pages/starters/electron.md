# Build an Electron desktop app

The [Electron starter](https://github.com/katabase-ai/katakit/tree/main/templates/electron) uses Moonshine Tiny to recognize local microphone audio. Finalized segments feed Katakit transcript ingestion; provisional speech and completed turns appear in a desktop window. It does not capture system audio, archive recordings, or persist transcripts.

## Run and trace the boundary

Copy the directory and follow its [README](https://github.com/katabase-ai/katakit/blob/main/templates/electron/README.md) for install, build, and `pnpm start` from the copy. First use downloads a model. `electron/main.cjs` serves the built renderer on a secure `katakit://app` origin with COOP/COEP headers, allows microphone permission for that origin, and keeps Node integration disabled. `vite.config.ts` copies workers and WASM to `dist/transcription-assets/`. `src/main.ts` connects the recognizer's provisional/final/stop callbacks to `src/kit.ts` and displays Katakit turns. See the [transcription utility](../reference/transcription.md) for lifecycle and error handling.

Change the recognizer and view in the renderer, not by enabling Node integration or bypassing the secure origin. Stop and dispose recognition when the window closes. Text and audio remain local; the first model download and package installation need network access. `pnpm check` exercises a fake final segment and the build, **not microphone capture**. The earlier macOS/Electron check was for typed notes, so this new audio path still needs a real macOS smoke test and other operating systems and installer packaging remain unverified.
