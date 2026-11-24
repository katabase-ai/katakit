# Chrome extension application starter

The [Chrome extension starter](https://github.com/katabase-ai/katakit/tree/main/examples/starters/chrome-extension) captures tab audio, optionally mixes in microphone audio, and recognizes speech locally with Moonshine Tiny. Katakit conversation turns appear in a Chrome side panel.

The extension has three cooperating contexts. `public/background.js` coordinates user actions and stores finalized segments in `storage.session`. An offscreen document runs recognition: `src/capture.ts` owns media tracks and 16 kHz PCM, while `src/offscreen.ts` supplies that PCM to `createBrowserTranscriber`. The side panel uses `src/kit.ts` to ingest recognized text and `src/sidepanel.ts` to display turns.

### Status and limitations

Tab and microphone transcription have live checks in Chrome, but Stop/Start, panel reopening, and some permission/error paths remain unverified. Session storage is not durable transcript storage. See the [README's verification record](https://github.com/katabase-ai/katakit/blob/main/examples/starters/chrome-extension/README.md#verification) for details.

## Get started

Follow the [starter README](https://github.com/katabase-ai/katakit/blob/main/examples/starters/chrome-extension/README.md#copy-build-and-load) to copy, build, and load the extension unpacked in Chrome 116+. Open a normal HTTP(S) tab and the extension side panel. For microphone input, use **Enable microphone** to request access in a visible extension tab. Choose **Start recording**, allow the first model download to finish, then play speech in the tab or speak into the microphone. **Stop recording** drains pending results.

## Platform considerations

### Capture and extension permissions

The manifest declares tab capture, side-panel, offscreen, and storage permissions, grants access to the model download host, and allows WASM compilation in its extension-page content security policy. Microphone access is requested at runtime; denied microphone access still permits tab-only capture. Restricted browser pages cannot be treated like ordinary HTTP(S) capture targets.

The background process obtains a short-lived tab stream ID. The offscreen document redeems it before loading the model. Keep that ordering when changing startup; model loading must not consume the stream ID's useful lifetime.

### Runtime assets and CSP

Do not add manifest COOP/COEP: Chrome blocks this offscreen tab-capture path when it is cross-origin isolated. The packaged runtime supports extension pages with shared WASM memory without those headers. The build patches Moonshine's generated bindings to replace dynamic JavaScript construction forbidden by MV3 CSP. That patch fails if its expected runtime code changes; upgrades require a rebuild and a live extension check.

### Data and input lifetime

Audio is discarded after local recognition; model weights download from the provider. The background process retains at most 200 finalized segments in `storage.session` so the panel can reconstruct recent turns during the browser session; older segments are dropped. **Clear transcript** clears saved segments and displayed turns. Closing the panel may leave capture running: Stop is owned by the offscreen capture lifecycle, not by panel visibility. Preserve stop/drain/track cleanup when changing the message flow.

## Make it yours

- **Change the input:** adapt `src/capture.ts` and `src/offscreen.ts`, keeping PCM format, stream-ID ordering, and track ownership explicit. See [Transcription utilities](../reference/transcription.md).
- **Change application behavior:** configure plugins in `src/kit.ts`; keep application content replayable from events rather than a separate writable store.
- **Change the interface:** edit `src/sidepanel.ts`. Account for a panel attaching to an already-running recording and reconstructing turns from saved segments.
- **Add persistence:** replace the session-only retention policy deliberately. Define what survives a browser restart and how Clear removes it; never persist live tracks or recognition resources.

## Additional resources

- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) — how the extension's interface is hosted alongside a tab.
- [Chrome Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen) — creating and managing the document that owns capture and recognition.
- [Chrome tabCapture API](https://developer.chrome.com/docs/extensions/reference/api/tabCapture) — user-gesture requirements and stream-ID constraints.
