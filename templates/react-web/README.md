# React web Katakit template

A minimal React 19 browser app using `@katakit/core` and `@katakit/event-log` to validate and replay typed text locally. Manually tested in the OpenChamber browser panel on macOS 15.6 (browser engine/version not exposed); other browsers are unverified. The basic path needs no microphone, speech model, account, API key, or separate service. This is an event log, **not** a chat assistant or transcription app: it does not generate replies or record audio.

## Run from a copied directory

Copy the entire `templates/react-web` directory (including `vendor/`) outside the repository. With Node.js 24+ and pnpm 11.9.0:

```sh
cd react-web
pnpm install
pnpm build
pnpm test
pnpm dev
```

Open the local URL Vite prints (normally http://127.0.0.1:5173/). Enter text and press **Add text**; the event appears below. A whitespace-only submission displays an error; the previous events remain. `pnpm build` produces static files in `dist/`. To deploy, host `dist/` on a static HTTPS server; no backend is needed. The development server is only for local development.

In the Katakit workspace the same `pnpm --dir templates/react-web dev` command runs the UI. Standalone installation is the supported portability check; workspace installs may link packages instead of using the tarballs.

## Adaptation and data

`src/katakit.ts` assembles and starts Katakit, configures the validated event-log plugin, and exports the text-input method and event stream. `src/main.tsx` handles the form, display, errors, and subscription cleanup. Replace the schema and event emission there first when adding another input; add persistence deliberately if events should survive a reload. The current in-memory log is cleared on reload, has no size limit, and has no explicit stop method (the runtime currently exposes none). React unsubscribes when the UI unmounts.

The browser processes text in memory. It is neither stored on disk nor sent to a provider by application code. The browser requests no microphone or other special permissions and downloads no models. During development, Vite serves code locally; package installation uses the npm registry. A production host still receives the usual web requests to serve the app. Validation failures are shown inline without logging the submitted text. Do not add private input logging without user consent.

The copyable directory includes its own Apache-2.0 `LICENSE`. `vendor/katakit-core.tgz` and `vendor/katakit-event-log.tgz` are built from the template-standards revision `3dea321` (Apache-2.0; each archive includes its own package LICENSE, README, compiled JavaScript, declarations, and manifest). The workspace `pnpm --filter @katakit/core pack --pack-destination <destination>` and analogous `@katakit/event-log` command produce the archives; rename the output to the stable filenames above. Rebuild **both** when their sources change. `pnpm-workspace.yaml` overrides transitive `@katakit/core` references to the bundled archive. Other dependencies come from the registry. Review the archive contents when updating them; replace these files with published registry dependencies once available.

For shared Katakit APIs, see the [Katakit reference](https://github.com/katabase-ai/katakit/blob/main/docs/pages/reference/README.md) in the source repository.

## Verification

From the copied directory, run `pnpm test` for a deterministic test of the same Katakit assembly used by the UI: emission, history, replay for a late subscriber, and rejection of an empty event. From the repository root, run `pnpm templates:check` and `pnpm templates:copy-check react-web`. The latter copies this directory to a temporary folder, installs, and builds it. Manual browser check: add a short note, confirm it appears once, submit spaces and confirm an inline error, then reload and confirm the log is empty. The app has no automated UI test or persistence; test additional browsers and accessibility with your own deployment before shipping.
