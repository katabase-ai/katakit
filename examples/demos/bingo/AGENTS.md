# Working on conversation bingo

The [README](README.md) describes what this example demonstrates. This guide covers
running and modifying an independent copy.

## Setup and commands

Use Node.js 24 or newer and pnpm 11.9.0. To get the example:

```sh
npx degit katabase-ai/katakit/examples/demos/bingo conversation-bingo
cd conversation-bingo
```

From the copied directory:

```sh
pnpm install
pnpm dev
```

Open the localhost URL printed by Vite. `pnpm build` creates `dist/`, `pnpm tsc`
checks types, and `pnpm test:ci` runs tests. Keep the whole directory when copying
it again; dependencies and runtime asset setup are declared locally.

## Use the demo

Start listening and grant microphone permission. Moonshine Small streaming recognition
downloads its model on first use. Audio stays in the browser. The board and transcript
are held in memory and reset on reload.

Choose a word list to start a new round. Finalized speech feeds transcript ingestion
and Bingo matching; provisional recognition appears in italics without marking squares.
Click a square to mark or unmark it, including to correct recognition mistakes.

## Code organization

- `src/app.tsx` mounts React, loads the standalone base styles, and owns the
  standalone microphone hook, capture controls, and DevTools. Import the domain
  component directly when embedding the demo; the app entry mounts the page on load.
- `src/bingo/bingo.tsx` renders the card and word-list picker, passes transcript data
  to the local UI widget, and imports the Bingo-specific `style.css`.
- `src/bingo/` also contains events, the plugin, word lists, and `useBingoKatakit.ts`.
- `tests/` covers the plugin and word lists.
- `src/ui/TranscriptTurns.tsx` renders completed, pending, and provisional transcript
  text from plain props; it does not import Bingo state. Its styles live alongside it.
- `src/ui/` contains local visual primitives (`controls.tsx`, `AudioLevelMeter.tsx`)
  and their styles. Keep domain components outside this directory.
- `src/base.css` contains the standalone theme and global resets; import it only from
  `src/app.tsx`. `src/ui/controls.tsx` imports its own `controls.css`, and
  `src/ui/AudioLevelMeter.tsx` imports `audio-level-meter.css`.
- `src/bingo/style.css` contains Bingo-specific layout styling.

## Modification rules

Keep application code, styles, and assets inside this directory and import Katakit
through public package entry points. Keep controls local so a copied application can
change its appearance without adopting a shared UI package.

Game content comes from logged events. Keep provisional text and microphone activity
separate from durable game content. A new round gets a new runtime; replay must not
start recognition or draw replacement squares.

The standalone microphone hook owns capture. `useBingoKatakit` owns transcript ingestion
for the round and explicitly flushes/closes it on cleanup; callback subscriptions belong
to their mounted components. Preserve that ownership when moving code. Do not assume
Katakit core provides a general runtime disposal method.

## Event model

The local [event definitions](src/bingo/events.ts) and [plugin](src/bingo/plugin.ts) model one
round. `gameStarted` records the actual dealt squares; `squareManuallyChanged` records a
player's explicit mark or unmark; `squareSpoken` records a speech match that marks a square.
The two input events preserve their different behavior and provenance. The plugin derives
`squares$`, `marked$`, and `winningLanes$` from these facts, without a second writable board.

A new round gets a new runtime and history. The microphone owner can keep transcription
running while the board changes. Replay reads the recorded layout and marks rather than
dealing again or matching the transcript again. History remains in memory for the round;
this demo does not import saved games. [Projection tests](tests/plugin.test.ts) compare
live board content with a fresh runtime seeded with the recorded Bingo events.

See [Designing event-sourced applications](https://github.com/katabase-ai/katakit/blob/main/docs/pages/concepts/event-sourcing.md)
for the general design method and resource-ownership requirements.

## Hosting and verification

Microphone access needs a secure, cross-origin-isolated context. Vite supplies the
headers on localhost. Static hosting must serve `Cross-Origin-Opener-Policy: same-origin`
on the document and `Cross-Origin-Embedder-Policy: require-corp` on the document and
runtime assets. The Vite `transcriptionAssetsPlugin` copies installed speech runtime
files into `dist/transcription-assets/`; deploy those assets with the page.

After changes, run `pnpm tsc`, `pnpm test:ci`, and `pnpm build`. Test deliberately at
behavior boundaries rather than mirroring implementation details. For UI or capture
changes, also check in a browser:

- Start/stop capture, model loading, and denied microphone permission.
- Speak a card phrase, wait for transcript ingestion, and verify the matching square.
- Click squares and change word lists; check the new round and transcript reset.
- Check narrow layouts and keyboard access; inspect the DevTools timeline in development.

Builds and synthetic tests do not establish real microphone or recognition behavior.
Report manual checks separately.
