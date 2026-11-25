# Browser conversation bingo example

## Run it locally

Copy this demo from GitHub and start it. You need Node.js 24 or newer and pnpm:

```sh
npx degit katabase-ai/katakit/examples/demos/bingo-react conversation-bingo
cd conversation-bingo
pnpm install
pnpm dev
```

The gallery's **Get the code** control shows the same command and a prompt for a coding agent.

## Prepare an independent copy from a checkout

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
In development, expand **Katakit devtools** and hover or focus a timeline dot
to inspect the stack for that observable delivery.
Inside the repository, build the utility before starting the example:

```sh
pnpm install
pnpm -F @katakit/transcription build
pnpm -F @katakit/react build
pnpm -F @katakit/demo-bingo-react dev
```

## Using the example

Start Moonshine Tiny streaming transcription with your microphone. The first use
downloads a model. Audio stays in the browser; the board and transcript reset on
reload. Finalized words appear in Transcript, newest line first; interim recognition text is shown there
in italics and is not used for bingo.

Choose a word list. Built-in packs draw a mix of familiar, less familiar, and
wildcard entries; choose **Shuffle** for another draw. Rare names and tricky words
may be misheard by the recognizer; click a square to correct it. Switching lists
or shuffling rechecks the current transcript and clears manual corrections. You
can do either without stopping transcription.

## Modifying and hosting

### Replay and lifecycle

`createBrowserBingoDemo()` owns an in-memory `@katakit/event-log` containing
finalized transcript segments/turns/resets and board/override commands.
`runtime.getHistory()` returns a copied history; construct
`createBrowserBingoDemo({ initialEvents: history })` to validate and replay it.
The default app still resets on reload: this API adds no automatic persistence.

Board draws record their actual squares. Evidence, marks and wins are projected
from those squares and the finalized transcript, including the unfinished turn.
Changing the board immediately rematches existing text. Replay preserves source,
segment and turn IDs and does not start microphones, models, timers or new log
writes. Provisional text and preview expiry are live display state only.

The microphone/gallery host stops and drains its input before `runtime.close()`.
Ingestion owns live turn-silence timers; Bingo detaches its content subscriptions
on close. Closing a restored, untouched history does not create a new turn.

Manual browser verification: start microphone recognition, say a board phrase,
confirm it marks before the turn silence timeout, switch/shuffle the board while
speaking, apply a manual correction, then stop and navigate away/back. Confirm
input releases and the new visit has a fresh transcript. Synthetic replay and
copy tests do not verify microphone permissions, speech accuracy, model downloads,
browser isolation headers in a deployed host, or native extension capture.

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
