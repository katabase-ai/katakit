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
- `src/color-clash/createColorClash.ts` owns the session's game state, speech scoring,
  and subscriber list. `close()` stops updates and clears subscribers; it does not
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
The existing game runtime keeps a mutable snapshot rather than deriving durable
game content from an event log. This is pre-existing migration work, not a pattern
to copy into new examples. If changing that state model, record randomized targets
and deadlines as events; replay must not redraw targets or restart capture or timers.

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
