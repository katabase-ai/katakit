# Conversation bingo extension example

## Prepare an independent copy

From an installed Katakit checkout, run:

```sh
pnpm examples:copy demos/bingo-extension /tmp/my-bingo-extension
cd /tmp/my-bingo-extension
pnpm install
pnpm build
pnpm test
```

## Standalone setup

Use Node.js 24 or newer and pnpm 11.9.0. Copy this entire directory anywhere outside the
repository; no gallery, sibling example, or shared application UI is needed.
React, React-RxJS, Vite, TypeScript, and the utility dependencies are declared
in `package.json`.

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
They do not use a semantic classifier. Click any of the 25 squares to correct a mark.
Choose from seven built-in word lists or select **Shuffle** for
another draw. Previously saved custom cards remain selectable. Switching lists
or shuffling starts a fresh round, clearing the prior transcript and manual corrections.
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

`examples/demos/bingo-react/src/bingo/` is the canonical implementation. The extension
contains an identical local copy so either example remains independently usable.
When changing Bingo behavior, update the canonical directory and copy it to
`examples/demos/bingo-extension/src/bingo/`, including its tests and README. Run
`pnpm bingo:check-copy` from the repository root; the lint check rejects missing,
extra, or changed files in the extension copy. Standalone users can modify their
local copy without the repository check.
