# Conversation bingo extension example

## Standalone setup

Use Node.js 24 or newer and pnpm 11.9.0. Export this example from the repository root:

```sh
pnpm demo:export bingo-extension /path/to/bingo-extension
```

The exported directory contains real files, not links to other examples; move or copy it
anywhere. The repository uses symlinks for shared example sources, so copying a raw demo
directory instead of exporting it may leave broken links.
No gallery, sibling example, or shared application UI is needed.
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

Build from the copied example directory:

```sh
pnpm build
```

At `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and
select the generated `dist/` directory. Chrome 116 or newer is required.
`pnpm tsc` checks types and `pnpm test` runs the tests.
Inside the repository, build the utility before building the extension:

```sh
pnpm install
pnpm -F @katakit/transcription build
pnpm -F @katakit/demo-bingo-extension build
```

## Using the example

On a regular HTTP(S) meeting tab, open the extension's side panel and click
**Start listening**. The first use downloads Moonshine Tiny Streaming from
`download.moonshine.ai`; transcription runs in an extension worker. Tab audio is
played back to the speakers. The microphone permission prompt is optional; if
denied, bingo continues using tab audio only. Stop capture before reloading the
extension.

Squares match complete normalized phrases against finalized transcript turns.
They do not use a semantic classifier. Click a square to correct a mark; the
center is free. Choose from seven built-in word lists or select **Shuffle** for
another draw. Previously saved custom cards remain selectable. Switching lists
or shuffling rechecks the current transcript and clears manual corrections.
Interim recognition text is not displayed or used for bingo.

Board edits and the selected pack are stored in extension local storage;
transcript history lasts for the browser session. Rare names and tricky words
may require manual correction. No account or external bingo API is required.

## Modifying the example

Edit `src/BingoPanel.tsx` for React UI and storage wiring, `src/bingo/` for board
state, matching rules, and word lists, and `src/AudioLevelMeter.tsx` for the meter.
Styling lives in `src/style.css`, `src/tokens.css`, and
`src/audio-level-meter.css`.

Audio capture lives in `src/capture.ts`, `src/offscreen.ts`, and
`public/pcm-worklet.js`. The capture coordinator is `public/background.js`.
Audio-level reporting and the extension manifest are included in this directory.
The transcription utility provides speech workers and the Vite asset plugin. Build and load the extension again
after editing source files.

## Maintaining the repository copy

`demos/bingo-react/src/bingo/` is the canonical implementation. The extension links
to that directory in the repository; `pnpm demo:export bingo-extension <destination>`
materializes its own Bingo directory, including tests and README. The meter CSS
also links to the browser example's source. Run `pnpm demo:check-links` to verify
the repository links. Standalone users can modify their exported copy independently.
