# Build a Chrome extension

The [Chrome extension starter](https://github.com/katabase-ai/katakit/tree/main/templates/chrome-extension) puts a tiny Katakit text interaction in a Manifest V3 side panel. `@katakit/core` hosts a template-owned plugin: entering text updates a local list of turns. An optional tab/microphone capture experiment is present, but it is separate from the text flow: **it does not transcribe audio or add turns**. You can learn the Katakit wiring without requesting media permissions.

## Run and observe

Copy the entire `templates/chrome-extension/` directory and follow its [README](https://github.com/katabase-ai/katakit/blob/main/templates/chrome-extension/README.md) for install, build, test, and **Load unpacked** steps in `chrome://extensions`. Choose the built `dist/` directory, open the side panel, add a text line, and clear it. Submitting an empty field should add nothing. Reloading or closing the panel discards the in-memory turns. These are **manual test instructions, not a claim that the extension was loaded successfully** in this work.

## Trace the extension boundary

1. `src/kit.ts` defines a small local plugin using an RxJS subject, assembles Katakit, and exposes `addText`, `clearText`, and `turns$`. Change this plugin if your application needs a different kind of state or method. The text flow does not depend on capture.
2. `src/sidepanel.ts` subscribes to turns, renders each as DOM text, handles the form and clear button, and closes the plugin when the panel unloads. `sidepanel.html` is its UI; `public/manifest.json` declares the MV3 panel and service worker.
3. If you opt into media, `public/background.js` handles the capture request and `src/offscreen.ts` manages the offscreen document. `src/capture.ts` samples audio; the samples are discarded. To make audio useful, add an explicit recognizer and feed only the text you choose into Katakit. That changes model downloads, permissions, and data handling and requires a separate end-to-end test.

For a text-only extension, consider removing the optional capture controls and the `activeTab`, `tabCapture`, `offscreen`, and `storage` permissions you no longer use. The current manifest requests those permissions for the optional experiment; the basic typed-text interaction makes no network request and keeps text in panel memory. Capture may continue after the panel closes until explicitly stopped. The README details status storage, microphone permission behavior, and cleanup.

## Limits and verification

**Provisional.** The copied directory installs, builds, and passes a deterministic Katakit text test. Chrome 157.0.8103.51 was available, but the environment prevented loading the unpacked extension, so the UI, permissions, capture, and Chrome 116+ compatibility are not manually verified. Before relying on it, test the README's text flow in an unpacked extension, then test denied capture permission and stop/release separately if you keep the optional audio path. Build success alone cannot verify MV3 behavior.
