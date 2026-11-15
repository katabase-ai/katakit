# React transcription demo

From the repository root, run `pnpm install` and `pnpm demo:transcription`.
Use a secure, cross-origin-isolated context; Vite serves the required headers on localhost.
Choose Moonshine Tiny, Small (the default), or Medium Streaming, or Whisper Tiny English.
Grant microphone access and speak; the Katakit transcription plugin groups finalized lines
into conversation turns. Moonshine offers live provisional text; Whisper runs in a worker
on roughly ten-second audio chunks, so its text appears later and has no live preview.

The first use of each model downloads its assets from its model provider. Audio stays in
the browser and is not sent to an application server. Transcripts are held in memory and
cleared on reload. Stop drains pending recognition and flushes the current turn. Change
models only between recordings: the old model is closed, existing turns remain visible,
and each recording gets a distinct source ID.

The transcript view uses React-RxJS: a module-scoped `bind(state$)` creates the hook
that renders the latest property value, and a `Subscribe` boundary owns the shared
UI subscription and releases it on unmount. Microphone and model disposal remain
owned by the host effect. See the [React integration guide](../../docs/pages/getting-started/react.md).

Both providers use the [shared model utilities](../../pkgs/transcription/README.md#shared-model-utilities)
for model loading, recognition, normalized results, and cleanup. `createMicrophoneInput`
owns microphone capture and feeds PCM to that source-neutral API; `whisperWorker.ts`
installs the shared worker runtime. `moonshineAssetsPlugin` serves and copies the SDK's
ESM, WASM, and pthread files without changing their sibling layout.

Built static hosting also needs
`Cross-Origin-Opener-Policy: same-origin` on the document and
`Cross-Origin-Embedder-Policy: require-corp` on the document and Moonshine assets.
