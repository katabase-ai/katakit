# React transcription demo

From the repository root, run `pnpm install` and `pnpm demo:transcription`.
Use a secure, cross-origin-isolated context; Vite serves the required headers on localhost.
Grant microphone access and speak; Moonshine SmallStreaming transcribes locally, and the
Katakit transcription plugin groups finalized lines into conversation turns.

The first run downloads the model. Nothing is sent to an application server. Transcripts
are held in memory and cleared on reload. Stop finishes any outstanding recognition and
flushes the current turn; another recording can then use the same loaded model.

The Moonshine host integration ports `createMicrophoneModel`, `createMicrophoneCapture`,
`microphoneCaptureWorklet`, and `moonshineAssetsPlugin` from protozoa-app's in-meeting
developer tools. Board IDs, speaker attribution, server clock alignment, and delivery
queues are deliberately not part of this demo. Built static hosting also needs
`Cross-Origin-Opener-Policy: same-origin` on the document and
`Cross-Origin-Embedder-Policy: require-corp` on the document and Moonshine assets.
