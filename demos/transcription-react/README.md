# React transcription demo

From the repository root, run `pnpm install` and `pnpm demo:transcription`.
Use a secure, cross-origin-isolated context; Vite serves the required headers on localhost.
Choose Moonshine Tiny, Small (the default), or Medium Streaming, or Whisper Tiny English.
Grant microphone access and speak; the Katakit transcript ingestion plugin groups finalized lines
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

Both providers use [`@katakit/transcription`](../../pkgs/transcription/README.md).
`createMicrophoneTranscriber` owns microphone capture, model loading, worker communication,
normalized recognition results, audio levels, and cleanup. The application owns the UI
and connects callbacks to the transcript ingestion plugin. There are no demo-owned workers,
worklets, or provider SDK loaders. `transcriptionAssetsPlugin` serves/copies all runtime files;
the development command builds the workspace utility first.

Built static hosting needs `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` for Moonshine's default threaded runtime.
Whisper itself uses one inference thread and does not require those isolation headers;
the demo configures them so either provider can be selected. For a Vite `base` other
than `/`, set `assetsBaseUrl` to `${import.meta.env.BASE_URL}transcription-assets/` in the helper options.
