# Build a React web app

The [React starter](https://github.com/katabase-ai/katakit/tree/main/templates/react-web) records microphone audio with `createMicrophoneTranscriber` and Moonshine Tiny. Provisional speech appears during recording; finalized segments go through Katakit's transcript-ingestion plugin and become turns. The typed event-log example has been replaced: a validated text form alone is no longer the intended starter.

## Run and trace the path

Copy the entire directory (including `vendor/`) and follow its [README](https://github.com/katabase-ai/katakit/blob/main/templates/react-web/README.md) to install, build, test, and run Vite. Start from the localhost URL, allow microphone access, speak, then stop. First use downloads model weights. `src/main.tsx` maps the recognizer's `onProvisional`, `onFinal`, and `onStop` callbacks to methods in `src/katakit.ts`; the latter configures transcript ingestion and exposes turn observables. The React UI subscribes to those observables and releases the input on unmount. `vite.config.ts` ships the transcription worker, worklet, WASM, and SDK assets.

Replace the model/input or display in `src/main.tsx` without modifying Katakit's ingestion plugin. Finalized segments have source and segment IDs; Stop flushes remaining text. To persist turns, add explicit storage and retention policy: they currently disappear on reload. No application server receives the audio or transcript. First model download contacts the provider. Production Moonshine needs HTTPS and COOP/COEP headers, not just Vite's local defaults; see [Transcription utilities](../reference/transcription.md).

The copied project builds and its fake-final-segment test passes. In a manual check on **macOS 15.6 / Chrome 157**, model-loading progress appeared; the user reported a finalized Katakit turn from microphone speech, a second turn after Stop/Start, turns clearing on reload, and an actionable error with the Chrome microphone permission blocked. The separate browser panel also showed permission denied. A cold-cache download, provisional-text rendering, other browsers, and deployed HTTPS/COOP/COEP isolation remain unverified.
