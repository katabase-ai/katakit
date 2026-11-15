# Chrome extension template

Minimal Manifest V3 audio host: popup opens the side panel; the background service worker
gets a tab-capture stream ID on user action; an offscreen document captures tab and
optional microphone audio. `src/capture.ts` emits 16 kHz mono PCM and restores tab
playback. No bingo rules, speech model, server, or Katakit plugin is baked in.

Run `pnpm --filter @katakit/template-chrome-extension build` at the repository root.
At `chrome://extensions`, enable Developer mode and load this package's `dist/`
as an unpacked extension. Open a regular HTTP(S) tab before starting capture.
The microphone permission prompt is optional: rejecting it continues with tab audio.
Stop capture before reloading the extension. Chrome 116+ is required for an
offscreen document to use a tab-capture stream ID from the service worker.

To make another extension, copy this directory and replace `src/offscreen.ts`'s
`onSamples` callback with a transcriber. Deliver finalized text to a Katakit plugin
from the host; keep browser permissions, model assets, and capture lifecycle here.
The [bingo demo](../../demos/bingo-extension/README.md) illustrates this split.
