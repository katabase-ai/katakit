# React web microphone transcription starter

Record English speech in the browser with Moonshine Tiny. Finalized segments go to Katakit's transcript-ingestion plugin and appear as conversation turns. Provisional speech appears while recording. Audio is processed locally; the transcript stays in memory and disappears on reload. This is not a chat assistant or a persistent transcript app.

## Copy and run

Use Node.js 24+ and pnpm 11.9.0. Copy this entire directory outside the repository, then run from inside the copy:

```sh
pnpm install
pnpm build
pnpm test
pnpm dev
```

Open Vite's localhost URL. Click **Start recording**, allow microphone access, speak, then click **Stop recording**. The first recording downloads Moonshine Tiny model weights from the model provider; allow time and internet access. The status shows loading, permission errors, and recording state. `pnpm build` emits `dist/` including `transcription-assets/`. A deployed site needs HTTPS and `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers on its document and runtime assets. Vite provides these headers during development and preview; your production host must provide them itself. Browser microphone permissions and cross-origin isolation are required.

## Where to change it

- `src/katakit.ts` configures transcript ingestion and exposes the methods for provisional/final text and Stop/flush. `src/main.tsx` uses `createMicrophoneTranscriber` from `@katakit/transcription/browser` to connect speech callbacks to those methods, displays Katakit turns, and disposes the input on unmount.
- `vite.config.ts` includes packaged workers, worklet, WASM and SDK assets. Replace the input or render path here without importing files from a sibling demo. Stop and dispose the input before switching models.
- `test/katakit.test.mjs` checks finalized speech and flushing without a microphone.

## Verification

The copied project builds and the deterministic finalized-segment test passes. Manual checks on **macOS 15.6 / Chrome 157** covered model-loading progress, a final turn from spoken audio, another turn after Stop/Start, turns clearing on reload, and a usable microphone-permission error. A cold-cache download, provisional-text display, other browsers, and deployed HTTPS/COOP/COEP isolation remain unverified.

For a new manual check, record the OS/browser version and whether each scenario passes: first model download, spoken audio producing a final turn, provisional display, Stop/Start, denied permission, reload, and deployed hosting. Run these in the copied application; automated segment tests do not exercise a microphone or recognizer.

Model weights download from the provider on first use. No microphone audio or transcript is sent to an application server by this starter. For the shared API, see the [Katakit reference](https://github.com/katabase-ai/katakit/tree/main/docs/pages/reference).
