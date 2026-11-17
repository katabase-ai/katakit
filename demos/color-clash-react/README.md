# Color Clash

Say the ink color, not the word. Correct answers pop the target and score a point
in a twenty-second round. Four distinct colors, a brief instruction screen, a
score, and a scrolling transcript keep the interaction visible.

This React example uses only `@katakit/transcription`. Color matching and scoring
are ordinary local code; no language-model service or API key is needed.

## Run in this repository

Use Node.js 24 or newer and pnpm 11.9.0. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm -F @katakit/transcription build
pnpm -F @katakit/demo-color-clash-react dev
```

Open the localhost URL printed by Vite. **Play** loads Moonshine Tiny Streaming
and requests microphone access. Instructions and the round timer start only
after capture is ready. Model files download on first play; audio and transcripts
stay in memory on your device. The round stops capture automatically. Replay
retains the loaded model; cancelling setup releases it. Hiding the tab stops
capture, including a pending microphone start.

```sh
pnpm -F @katakit/demo-color-clash-react build
pnpm -F @katakit/demo-color-clash-react preview
pnpm -F @katakit/demo-color-clash-react test:ci
```

The shared gallery also lists the game at `/demos/color-clash`:

```sh
pnpm -F @katakit/gallery dev
```

The gallery supplies its shared speech owner and model picker. Its Play action
starts the game; choose a Moonshine Streaming model for immediate responses.
Whisper returns text in batches, so its scoring arrives later.

## Copy the standalone example

The entire `demos/color-clash-react/` directory can run outside this repository.
It imports no gallery, sibling demo, or private website code. The transcription
package is currently version `0.0.0` and is not on the public npm registry. Build
and pack it from this repository:

```sh
pnpm -F @katakit/transcription build
mkdir -p /tmp/color-clash-packages
pnpm -F @katakit/transcription pack --pack-destination /tmp/color-clash-packages
```

Copy this example directory to a new location and copy the resulting tarball
into its `vendor/` directory. Add this to the copied `pnpm-workspace.yaml`:

```yaml
overrides:
  '@katakit/transcription': file:vendor/katakit-transcription-0.0.0.tgz
```

From the copied directory, run `pnpm install`, then `pnpm dev` or `pnpm build`.
Retain the tarball and override when moving the example again.

## Adapt or host it

`src/createColorClash.ts` owns scoring, provisional/final word deduplication, and
the round clock. `src/ColorClash.tsx` renders the game and accepts host-owned speech
state and actions. `src/App.tsx` owns standalone microphone setup and cleanup.
The gallery imports only the game view and runtime, not the standalone bootstrap
or global styles. A consuming host can use the named `colorClashGalleryDemo`
entry from `demos/gallery/shared/galleryDemos.tsx` with a `GallerySpeechProvider`.

Vite serves isolated localhost documents and copies worker/WASM assets to
`dist/transcription-assets/`. Production hosting must serve the document and
runtime assets with `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`, over HTTPS. No backend is required.
