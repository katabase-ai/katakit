# Conversation bingo extension demo

From the repository root run `pnpm --filter @katakit/demo-bingo-extension build`,
then load `demos/bingo-extension/dist/` at `chrome://extensions` (Developer mode,
Load unpacked). On a regular HTTP(S) browser meeting tab, open the extension's
side panel and click **Start listening**. The first use downloads Moonshine Tiny
Streaming; transcription runs in an extension worker, not on an application server.
Tab audio is played back to the speakers; a microphone permission prompt is
optional. If denied, bingo continues using tab audio only. Chrome 116+ is needed.

Squares match complete normalized phrases against finalized words in Katakit's
transcript turns using `@katakit/bingo`. They do not use a semantic classifier. Click a square to
correct a mark. The center is free. Choose from seven built-in word lists or
select **Shuffle** for another draw. Previously saved custom cards remain
selectable, but the demo no longer offers a card editor.
You can switch lists or shuffle during capture; the new card rechecks the
current transcript and clears manual square corrections.
Rare names and tricky words may require manual correction. Board edits and the
selected pack are stored in extension local storage, while
transcript history lasts for the browser session. Stop capture before reloading
the extension. Model download needs access to download.moonshine.ai. Last heard
previews finalized words only; bingo squares also match only finalized words.

This demo uses the audio capture implementation from
`templates/chrome-extension/src/capture.ts`, the template's background and
worklet assets, and `@katakit/transcription` for turn assembly. Browser audio
and model setup stay in the host. No account or external bingo API is required.

The panel binds only `lastHeard$` and the board with React-RxJS.
A `Subscribe` boundary owns those UI subscriptions and releases them on unmount.
The bingo plugin effect keeps matching independently; the host manages extension listeners.
See the [React integration guide](../../docs/pages/getting-started/react.md).

Recognition uses the standalone `@katakit/speech` PCM API inside the existing extension worker.
`speechAssetsPlugin` packages Moonshine's runtime files; capture, permissions, and extension
messages remain owned by the extension host. See the [speech utility guide](../../pkgs/speech/README.md).
