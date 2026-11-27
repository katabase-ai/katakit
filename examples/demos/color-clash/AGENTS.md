# Working on Color clash

The [README](README.md) describes what this example demonstrates. This guide covers
running and modifying an independent copy.

## Setup and commands

Use Node.js 24 or newer and pnpm 11.9.0. To get the example:

```sh
npx degit katabase-ai/katakit/examples/demos/color-clash color-clash
cd color-clash
```

From the copied directory:

```sh
pnpm install
pnpm dev
```

Open the localhost URL printed by Vite. `pnpm build` creates `dist/`, `pnpm tsc`
checks types, and `pnpm test:ci` runs tests. Keep the whole directory when copying
it again; dependencies and speech assets are declared locally.

## Use the demo

Choose **Play** and grant microphone access. The first play downloads an English
speech model. Say the ink color of the displayed word, not the written word. The
20-second round scores matching answers; **Play again** starts a fresh round.
Microphone audio and recognized text stay on your device. Cancel setup or leave
the page to stop and dispose of the standalone microphone owner.

## Code organization

- `src/app.tsx` mounts React and imports `src/base.css`, which contains standalone
  theme defaults and global resets. Do not import it from gallery-owned code.
- `src/color-clash/ColorClashApp.tsx` owns the standalone microphone hook and its
  callbacks. Cancellation remounts a keyed session: the hook stops and disposes
  the previous transcriber asynchronously after pending results drain.
- `src/color-clash/ColorClash.tsx` renders the game from its runtime and host-owned
  input state. Its timer is cleared on phase change or unmount; it asks its host to
  stop capture when the round finishes.
- `src/color-clash/events.ts` defines typed `KatakitEvent` domain facts. The local
  `plugin.ts` projects the board, score, mistake and phase from the event log and
  admits game commands. `createColorClash.ts` owns a transient live-capture phase
  (including instructions and cancellation), recognition positions, transcript
  display, and the read-only view snapshot. That phase tracks capture eligibility,
  not a second writable game board; the view can show replayed game content without
  owning a live round.
  `events$.getAll()` returns the accepted typed history (including metadata);
  supply it as `initialEvents` for in-memory replay. No serialized history is
  accepted by this demo. Replay does not draw targets, start capture, or arm a
  clock. `close()` unsubscribes from the game projection and clears subscribers; it does not
  dispose capture. The standalone hook owns capture disposal on unmount; gallery
  lease release stops and drains capture before closing the runtime. The view
  unsubscribes from the runtime on unmount. `src/color-clash/style.css` styles only
  the game, so the gallery can embed it without importing a standalone reset.
- `tests/` covers timing, provisional/final speech, retries, cancellation, and
  the capture-stop boundary. Keep tests on behavior, not file placement.

## Modification rules

Keep application code, styles, and assets inside this directory and import Katakit
through public package entry points. Host-specific microphone and action controls
belong in the standalone app or the gallery adapter, not in a shared package.
The game log belongs to one runtime visit. The standalone microphone hook and gallery
lease own capture, while the view owns and clears its 50ms display clock. Neither is
recreated by a replayed event; no persistent storage is chosen by this example.

## Event model

The 1.6-second instruction screen is transient setup. Only after it completes with
live capture does `roundStarted` record the first chosen target and a 20-second
deadline. Leaving during instructions creates no round history. Each accepted
color records `targetMatched` (including the next chosen target) or `targetMissed`;
`roundEnded` records expiry or interrupted capture. `game$` is a projection of
those facts, not a second writable board. Provisional revisions, the final text
shown in the live transcript, word-position deduplication, and clock ticks are
transient. A new Play after a finished round resets the board through another
`roundStarted`, without inventing events while replaying earlier rounds.

## Hosting and verification

Microphone access needs a secure, cross-origin-isolated context. Vite supplies the
headers on localhost. Static hosting must serve `Cross-Origin-Opener-Policy: same-origin`
and `Cross-Origin-Embedder-Policy: require-corp` on the document and runtime assets.
The Vite `transcriptionAssetsPlugin` copies the worklet, workers, and WASM files to
`dist/transcription-assets/`; deploy those assets with the page.

After changes, run `pnpm tsc`, `pnpm test:ci`, and `pnpm build`. For changes to UI,
speech, or capture, also check in a supported browser:

- Grant microphone access, speak an ink color, and verify the score increments;
  saying the written word does not score.
- Let the 20-second clock expire and confirm capture stops. Replay should start a
  clean round, without stopping the newly acquired microphone.
- Cancel during model download and recover from denied microphone permission.
- Check a narrow layout and keyboard access; navigate away while listening and
  confirm that capture stops and releases its resources.

Builds and synthetic tests do not establish real recognition quality or microphone
behavior. Report manual checks separately.
