# Build a Chrome extension

The [Chrome starter](https://github.com/katabase-ai/katakit/tree/main/templates/chrome-extension) captures tab and optionally microphone audio, runs Moonshine Tiny locally in an MV3 offscreen document, and sends final recognized segments to Katakit transcript ingestion in the side panel. The previous typed-text interaction and discarded-audio placeholder are no longer its intended basic path.

## Run and trace the extension boundary

Copy the whole directory, follow its [README](https://github.com/katabase-ai/katakit/blob/main/templates/chrome-extension/README.md) to install/build/test, and load `dist/` unpacked in Chrome 116+. Use a normal HTTP(S) tab and open the extension side panel; Start loads the model (downloading weights on first use) and captures audio, while Stop drains final results. `public/background.js` coordinates the user gesture and stores short-lived transcript segments in `storage.session`. `src/capture.ts` owns 16 kHz PCM and media tracks; `src/offscreen.ts` feeds it into `createBrowserTranscriber`; `src/kit.ts` ingests recognized text into Katakit turns displayed by `src/sidepanel.ts`.

The manifest declares tab capture, optional mic, model host access and isolation/CSP needed by the SDK. Chrome's session storage retains text across a side-panel reopen but not a browser restart. Audio is discarded after local recognition; weights download from the model provider. To adapt the app, change the input or plugin while keeping stop/drain/cleanup and extension permissions in sync. See [Transcription utilities](../reference/transcription.md) for PCM input and recognition lifecycle.

The copied directory builds and the fake-segment Katakit test passes. **The new unpacked extension recognition path still needs a real Chrome run**, including tab-only permission denial, first model load, Stop/Start, panel reopening, and restricted-tab failure.
