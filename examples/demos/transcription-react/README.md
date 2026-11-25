# React transcription example

## Run it locally

The event-log integration on this branch requires the updated transcript-ingestion
package. Registry pins remain at `0.1.0`; an npm release and pin update are required
before the standalone registry install below includes this API. Contributor copy
checks use freshly packed local libraries instead.

Copy this demo from GitHub and start it. You need Node.js 24 or newer and pnpm:

```sh
npx degit katabase-ai/katakit/examples/demos/transcription-react local-transcription
cd local-transcription
pnpm install
pnpm dev
```

The gallery's **Get the code** control shows the same command and a prompt for a coding agent.

## Prepare an independent copy from a checkout

From an installed Katakit checkout, run:

```sh
pnpm examples:copy demos/transcription-react /tmp/my-transcription-react
cd /tmp/my-transcription-react
pnpm install
pnpm build
pnpm dev
```

## Standalone setup

Use Node.js 24 or newer and pnpm 11.9.0. Copy this entire directory anywhere outside the
repository; no gallery, sibling example, or shared application UI is needed.
React, React-RxJS, Vite, TypeScript, and the utility dependencies are declared
in `package.json`.

Run the example from its own directory:

```sh
pnpm dev
```

Open the localhost URL printed by Vite. `pnpm build` creates `dist/`;
`pnpm tsc` checks types and `pnpm test:ci` runs the tests.
Inside the repository, build the utility before starting the example:

```sh
pnpm install
pnpm -F @katakit/transcription build
pnpm -F @katakit/demo-transcription dev
```

## Using the example

Choose Moonshine Tiny, Small (the default), or Medium Streaming, or Whisper Tiny
English. Grant microphone access and speak; finalized lines are grouped into
conversation turns. Moonshine offers live provisional text. Whisper runs in a
worker on roughly ten-second audio chunks, so its text appears later and has no
live preview.

The first use of each model downloads its assets from its provider. Audio stays
in the browser and is not sent to an application server. Transcripts are held in
memory and cleared on reload. Stop drains pending recognition and flushes the
current turn. Change models only between recordings: the old model is closed,
existing turns remain visible, and each recording gets a distinct source ID.

## Modifying and hosting

`createTranscriptionDemo({ initialEvents })` restores validated in-memory history;
`getHistory()` returns the ordered log snapshot. `events$` exposes the replaying log,
and `state$` is a read-only projection, not a writable content store. Each finalized
segment appears immediately, while silence/Stop records its turn boundary. Replay
preserves IDs, source, speaker, and timestamps without starting capture, models, or
timers. Closing a restored-only runtime writes nothing. Fresh input continues its
pending turn; `reset()` records a reset and permits segment IDs to be reused.
Persistence remains a host choice; the standalone page still clears on reload.

Automated tests cover synthetic callback stop/drain, replay/continuation/reset/close,
and rendering. Manually verify microphone permission, first model download, recording,
Stop, model switching, and navigation cleanup in a browser for live capture evidence.

Edit `src/App.tsx` for React UI and transcript wiring, `src/controls.tsx` and
`src/AudioLevelMeter.tsx` for controls, and `src/base.css`, `src/style.css`, and
`src/audio-level-meter.css` for styling. Model selection and transcript wiring
are local. The transcription utility owns microphone capture, speech recognition, workers, and runtime asset serving.

Microphone access requires a secure, cross-origin-isolated context. Vite serves
the required headers on localhost. Static hosting must serve
`Cross-Origin-Opener-Policy: same-origin` on the document and
`Cross-Origin-Embedder-Policy: require-corp` on the document and runtime assets.
`transcriptionAssetsPlugin` includes the installed speech runtime in
`dist/transcription-assets/`.
