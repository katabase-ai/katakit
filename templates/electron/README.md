# Electron template

This is a minimal desktop application for Electron. It creates a Katakit runtime
with `@katakit/core` and `@katakit/event-log`: typing a note and pressing **Add
note** validates the text, emits an event, and displays it in the session list.
The input starts with a sample note so the interaction works immediately. This
is a starter, not the notes-and-audio demo: it has no recording, transcription,
AI service, or saved history.

## Run a copied directory

Copy **this entire directory**, including `vendor/`, anywhere outside the
Katakit repository. With Node.js 24 or newer and pnpm 11.9.0, run these commands
**from the copied directory**:

```sh
pnpm install
pnpm build
pnpm start
```

The build creates `dist/` from the renderer source; Electron loads that local
HTML file. Click **Add note** to submit the prefilled sample, then type another
note and press Enter. To see the validation failure, submit whitespace: the
app asks for text and keeps focus in the input. Closing the window clears the
list. No separate development server is required. In the Katakit workspace,
`pnpm --filter katakit-electron-starter build` also builds the template after
installing its dependencies.

## Where to adapt it

- `src/kit.ts` configures the event schema, instantiates Katakit, and exposes
  its input method and observable. Replace the schema and plugin for your own
  events first. The bundled Katakit packages are version `0.0.0` from source
  commit `3dea321`; they are not published to npm.
- `src/main.ts` connects the form to `emitEvent`, subscribes to event history,
  displays errors, and unsubscribes when the renderer closes. `index.html` and
  `src/style.css` contain the UI. There is no storage adapter: history exists
  only in renderer memory.
- `electron/main.cjs` creates the native window and loads `dist/index.html`.
  It enables renderer sandboxing and disables Node integration. No preload,
  IPC, OS permission, microphone, or network request is needed by the app.

The two built Katakit package tarballs in `vendor/` are copied with the template.
`package.json` declares them through `file:vendor/*.tgz` and
`pnpm-workspace.yaml` redirects the event-log's transitive `@katakit/core`
dependency to its bundled tarball. Other dependencies use registry versions.
To update the tarballs, build **both** `pkgs/core` and `pkgs/event-log` at the
same source revision in a separate Katakit checkout, run `pnpm pack` in each
package with `--pack-destination` pointing to this directory's `vendor/`, and
inspect each tarball's `package.json`, `LICENSE`, `README.md`, and `dist/` before
committing it. Do not use `workspace:*` in the copied template.

## Checks and platform status

Run `pnpm check` in the copied directory for a deterministic Katakit event test,
TypeScript check, and Vite build.
From a Katakit checkout, the coordinator also runs `pnpm templates:check` and
`pnpm templates:copy-check electron`, which installs and builds a standalone
copy. These checks do not replace the manual Electron interaction above.

Manually tested on macOS 15.6 with Electron 35.7.5, Node.js 24.14.1, and pnpm
11.9.0. Other desktop OSes and distributable app packaging/signing are
unverified; `pnpm start` runs a developer-installed Electron binary, not an
installer. Installation fetches registry packages and Electron; the app's
note text stays in memory on the device, is not persisted, and is not sent to
a server. If installation, building, or loading the window fails, errors appear
in the terminal; input validation errors appear beside the form.

For public Katakit API behavior, see the
[Katakit reference](https://github.com/katabase-ai/katakit/tree/main/docs/pages/reference).
