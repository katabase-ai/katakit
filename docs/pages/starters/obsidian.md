# Build an Obsidian plugin

The [Obsidian starter](https://github.com/katabase-ai/katakit/tree/main/templates/obsidian) records a short microphone clip in an Obsidian Desktop plugin view, runs single-thread Whisper Tiny inference **after Stop**, and passes the recognized text into Katakit transcript ingestion. It does not write vault notes, record audio permanently, or stream provisional speech. The first recording downloads the English model from its provider.

## Test in a disposable vault

Copy the entire directory and follow its [README](https://github.com/katabase-ai/katakit/blob/main/templates/obsidian/README.md) to install, build, and copy the two `dist/` files into a **new empty test vault** with the distinct `katakit-text-starter` plugin ID. Do not replace another plugin in your personal vault. `src/speech.ts` handles microphone permission, MediaRecorder, decoding, 16 kHz resampling and Whisper inference. `src/session.ts` ingests a finalized result into Katakit and flushes a turn; `src/main.ts` manages the view and cleanup. `build.mjs` forces the browser ONNX backend because Obsidian exposes a Node-like `process` and is not cross-origin isolated. The build fails if that library check changes.

Changing the text source or recognition model requires rechecking Obsidian's asset paths and runtime constraints. Audio/text stay in memory; model downloads and npm installation contact external providers. The independent transcription spike informed the approach but was not a test of this copied plugin. The copied directory builds and its fake-segment and recorder-error tests pass; **the new end-to-end path still needs a test-vault run** with first download, permission denial, empty clip, a second recording and view reopen. Mobile is unsupported.
