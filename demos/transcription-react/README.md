# React transcription example

## Standalone setup

Use Node.js 24 or newer and pnpm 11.9.0. Copy this entire directory anywhere outside the
repository; no gallery, sibling example, or shared application UI is needed.
React, React-RxJS, Vite, TypeScript, and the utility dependencies are declared
in `package.json`.

The utility dependencies `@katakit/core`, `@katakit/transcript-ingestion`, and
`@katakit/transcription` are currently version `0.0.0` and are not yet available on the public npm registry. Until they
are published, create installable tarballs from a checkout of this repository:

```sh
# In the repository root:
pnpm install
pnpm --filter @katakit/core build
pnpm --filter @katakit/transcript-ingestion build
pnpm --filter @katakit/transcription build
mkdir -p /tmp/example-utilities
pnpm --filter @katakit/core pack --pack-destination /tmp/example-utilities
pnpm --filter @katakit/transcript-ingestion pack --pack-destination /tmp/example-utilities
pnpm --filter @katakit/transcription pack --pack-destination /tmp/example-utilities
```

In the copied example directory, install those artifacts:

```sh
mkdir -p vendor
cp /tmp/example-utilities/*.tgz vendor/
```

Append these overrides to the copied example's `pnpm-workspace.yaml` so both
its direct and transitive utility dependencies resolve to the local artifacts:

```yaml
overrides:
  '@katakit/core': file:vendor/katakit-core-0.0.0.tgz
  '@katakit/transcript-ingestion': file:vendor/katakit-transcript-ingestion-0.0.0.tgz
  '@katakit/transcription': file:vendor/katakit-transcription-0.0.0.tgz
```

Then run `pnpm install` in the copied directory. Keep `vendor/` with the example
when moving it again; its source and installed dependencies no longer need the
repository. Once compatible utility versions are published, ordinary
registry versions can be used instead.

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
