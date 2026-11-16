# Katakit Chrome extension template

Manifest V3 starter for Chrome 116+. The basic path submits typed text in the side panel to
a tiny local plugin inside a running `@katakit/core` instance; text turns appear below the input.
No microphone, model, account, server, or download is needed. The build and typed-text test
ran on macOS with Chrome 157.0.8103.51 installed, but loading the unpacked extension could
not be completed in this environment. The Chrome UI path (including Chrome 116+) remains
**manually unverified**.

## Copy, build, and run

Requires Node.js 24+, pnpm 11.9.0, and Chrome 116+ (for optional tab capture). Copy this **whole
directory**, including `vendor/`, outside the Katakit repository. In the copied directory:

```sh
pnpm install
pnpm build
pnpm test
```

In `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose the
copied directory's `dist/`. Click the extension icon, open the side panel, type a short line and
press **Add text** (or Enter). The line appears under Text turns. **Clear text** resets the
Katakit conversation. Closing or reloading the side panel discards text. For a failure check,
try submitting an empty field: the browser requires text; without it, nothing is added. If
capture is desired, open an ordinary HTTP(S) tab first, click **Start capture**, and then
**Stop capture**; on a restricted tab the start reports an error instead.

Inside the Katakit repository, run the same `pnpm install`, `pnpm build`, and `pnpm test`
commands from `templates/chrome-extension/`; templates use their own pnpm workspace
settings, not the repository root install. Run `pnpm templates:check` and
`pnpm templates:copy-check chrome-extension` at the repository root to check the manifest
and an independently installed copy.

## Adaptation and data

- `src/kit.ts` defines a small typed-text plugin, assembles and starts Katakit, and exposes its
  observable and methods. `src/sidepanel.ts` connects the form and observable to the UI and
  closes the plugin on panel unload. Replace the plugin with your own processing logic first.
  For common API
  behavior see the [Katakit reference](https://github.com/katabase-ai/katakit/tree/main/docs/pages/reference).
- Optional audio capture is separate from the typed-text Katakit flow. `public/background.js`
  obtains a tab stream ID after a button click, `src/offscreen.ts` owns its lifecycle, and
  `src/capture.ts` samples 16 kHz mono PCM and restores tab playback. Samples are currently
  **discarded**: recording does not transcribe speech or add turns to Katakit. To implement
  transcription later, supply a transcriber to the offscreen callback, then forward only
  finalized text into a Katakit method; document any model downloads or remote data flow.
- The manifest requests `activeTab`, `tabCapture`, `offscreen`, `sidePanel`, and `storage` for
  that optional capture UI. Starting capture prompts for mic access; denying it allows tab-only
  capture. Stop releases media tracks and the offscreen document. Capture may continue if the
  side panel closes; reopen it to stop. The service worker stores only capture status in
  Chrome's temporary `storage.session`; typed text is kept only in side-panel memory. No
  audio, text, or credentials are sent to a server or saved to persistent storage. Capture
  errors and permission failures appear in the side panel; typed-text errors appear beside
  the form. Reload the extension after rebuilding `dist/`.

The core tarball under `vendor/` is a built package artifact from Katakit source commit
`3dea321` (Apache-2.0). It contains package metadata, license, README, and compiled `dist/`
JS/types, not workspace source or secrets. The workspace `pnpm-workspace.yaml` pins core to the
local artifact, including any future transitive use. To regenerate **from that same source revision**
at the repository root, run `pnpm --filter @katakit/core build`, then
`pnpm --filter @katakit/core pack --pack-destination <absolute-path-to-this-vendor>`; rename
`katakit-core-0.0.0.tgz` to `katakit-core.tgz`. Rebuild and review this artifact
whenever the packages change. Once Katakit is published, use registry versions instead.

This is a minimal typed-text starter, not a speech recognizer or persistent conversation app.
There is no packaging/signing or Chrome Web Store deployment configuration. Loading unpacked
is the intended installation path, not a verified platform test in this environment.
