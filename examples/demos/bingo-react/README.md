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
