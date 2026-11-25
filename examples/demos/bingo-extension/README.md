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
They do not use a semantic classifier. Click a square to correct a mark; the
center is free. Choose from seven built-in word lists or select **Shuffle** for
another draw. Previously saved custom cards remain selectable. Switching lists
or shuffling rechecks the current transcript and clears manual corrections.
Interim recognition text is not displayed or used for bingo.

Board edits and the selected pack are stored in extension local storage;
transcript history lasts for the browser session. Rare names and tricky words
may require manual correction. No account or external bingo API is required.

## Replay and storage lifetimes

Each panel mount creates an in-memory core `EventLogPlugin` transcript log in
`src/runtime.ts`. Finalized segments, completed turns, and resets are recorded events;
the ingestion plugin derives its transcript from those records. The canonical Bingo
plugin records board commands and combines its board projection with the transcript
projection to compute evidence and wins. Replay does not start recognition, capture,
silence timers, or replacement IDs.

The host validates both restored records and live writes before core admission.
Metadata-free legacy records receive deterministic sequence numbers and epoch log
timestamps; source IDs and audio timestamps are unchanged. Full recorded histories
retain their original log metadata and must have contiguous sequence numbers.

The existing storage boundaries remain separate:

- `chrome.storage.local` keeps the board's squares/manual overrides, selected pack,
  and saved custom card. Existing board snapshots are validated and imported through
  `restoreBoard`, which records a board command. Invalid boards fall back to the default.
  Transcript evidence is never persisted with the board.
- `chrome.storage.session` keeps the background host's latest 2000 unique finalized
  segments in delivery order. These transport snapshots seed transcript events when
  the panel opens. Invalid entries are skipped; source/segment IDs and timestamps are
  preserved. Duplicate source/segment identities use their first delivery. An open
  panel retains its current session in memory; reopening sees only the retained window.
  This legacy segment snapshot does not include live silence-timer turn boundaries:
  reopen groups segments deterministically by source, speaker, and timestamp gaps,
  which can differ from the previous panel's turn grouping. Full in-memory event
  history, including recorded turns, replays exactly; no timestamps are invented to
  approximate missing boundaries.
- Starting a new capture resets transcript history and evidence, while keeping board
  choices and manual corrections. Closing the panel leaves capture running in its
  offscreen owner. Reopening restores the board and current session independently.

The panel registers its message listener before reading storage, then hydrates the
snapshot before applying queued live messages. A reset received during the read
invalidates the old transcript snapshot. Snapshot/live overlap is deduplicated by
segment identity. Status, audio meters, recognition resources, and silence timers are
transient. Panel cleanup removes the listener and closes ingestion/board projections;
Stop listening drains capture and recognition, disposes the recognizer, waits for
transcript writes, and closes the offscreen document. Storage failure does not stop
capture, but a failed write cannot be recovered on the next panel open.

### Verification

`pnpm test` covers deterministic restoration/continuation, duplicate delivery,
retention, reset during hydration, legacy boards, and capture resource cleanup.
From the repository also run `pnpm demos:copy-check bingo-extension` and
`pnpm bingo:check-copy`. Copy checks use freshly packed local libraries; registry
pins must be updated after those library changes are published before a registry-only
copy can use the built-in core event log and new ingestion APIs.

Native Chrome checks require a meeting tab and microphone: start capture, hear a
matching phrase, correct a square, close/reopen the panel during capture, stop and
restart capture, and restart Chrome. Confirm that local board corrections survive,
session evidence clears on a new capture/browser session, and tab audio/microphone
resources stop after Stop listening. Automated mocks/builds do not verify Chrome
permissions, live Moonshine recognition, or native capture shutdown.

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
