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

The Moonshine host integration ports `createMicrophoneModel`, `createMicrophoneCapture`,
`microphoneCaptureWorklet`, and `moonshineAssetsPlugin` from protozoa-app's in-meeting
developer tools. Board IDs, speaker attribution, server clock alignment, and delivery
queues are deliberately not part of this demo. Whisper's worker and chunking approach is
adapted from protozoa-app's offscreen prototype. Built static hosting also needs
`Cross-Origin-Opener-Policy: same-origin` on the document and
`Cross-Origin-Embedder-Policy: require-corp` on the document and Moonshine assets.
