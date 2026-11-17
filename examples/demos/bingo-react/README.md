# Browser conversation bingo example

## Prepare an independent copy

From an installed Katakit checkout, run:

```sh
pnpm examples:copy demos/bingo-react /tmp/my-bingo-react
cd /tmp/my-bingo-react
pnpm install
pnpm build
pnpm dev
```

The copy includes built Katakit tarballs and local dependency overrides while the libraries
are unpublished. Keep `vendor/` with it. All application source stays in this directory.
No original checkout is needed after copying. Follow the platform and hosting instructions below.

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
pnpm -F @katakit/demo-bingo-react dev
```

## Using the example

Start Moonshine Tiny streaming transcription with your microphone. The first use
downloads a model. Audio stays in the browser; the board and transcript reset on
reload. Finalized words appear in Last heard; interim recognition text is not
displayed or used for bingo.

Choose a word list. Built-in packs draw a mix of familiar, less familiar, and
wildcard entries; choose **Shuffle** for another draw. Rare names and tricky words
may be misheard by the recognizer; click a square to correct it. Switching lists
or shuffling rechecks the current transcript and clears manual corrections. You
can do either without stopping transcription.

## Modifying and hosting

Edit `src/App.tsx` for React UI and transcript wiring, `src/bingo/` for board state,
matching rules, and word lists, and `src/controls.tsx` and `src/AudioLevelMeter.tsx`
for controls. Styling lives in `src/base.css`, `src/style.css`, and
`src/audio-level-meter.css`. The microphone host uses the transcription utility.
Its Vite asset plugin serves and copies the installed runtime files. No Chrome extension APIs are used.

Microphone access requires a secure, cross-origin-isolated context. Vite serves
the required headers on localhost. Static hosting must serve
`Cross-Origin-Opener-Policy: same-origin` on the document and
`Cross-Origin-Embedder-Policy: require-corp` on the document and runtime assets.
`transcriptionAssetsPlugin` copies the installed speech runtime into
`dist/transcription-assets/`.

## Maintaining the repository copy

`examples/demos/bingo-react/src/bingo/` is the canonical implementation. The extension
contains an identical local copy so either example remains independently usable.
When changing Bingo behavior, update the canonical directory and copy it to
`examples/demos/bingo-extension/src/bingo/`, including its tests and README. Run
`pnpm bingo:check-copy` from the repository root; the lint check rejects missing,
extra, or changed files in the extension copy. Standalone users can modify their
local copy without the repository check.
