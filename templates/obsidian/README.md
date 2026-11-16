# Obsidian text starter

This desktop-only Obsidian plugin assembles `@katakit/core` and
`@katakit/transcript-ingestion`. Type a transcript line (or keep the supplied
sample), click **Add line to Katakit**, and see a conversation turn appear.
This is **not** speech recognition: there is no microphone, audio recording,
model, service, or account. The text never leaves the device. The plugin keeps
it in memory only; closing the view discards it. It does not write notes.

## Build and install in a test vault

Use Node 24+ and pnpm 11.9.0. Copy this directory by itself, then run from
the copied directory:

```sh
pnpm install
pnpm build
pnpm test
```

Create a **new, empty test vault** in Obsidian Desktop. Do not install this
starter over another plugin or into a vault you care about. In that test vault,
create `.obsidian/plugins/katakit-text-starter/` and copy **both** `dist/main.js`
and `dist/manifest.json` there. In **Settings → Community plugins**, enable
community plugins and then enable **Katakit Text Starter**. Open the command
palette and run **Open Katakit text starter**. The plugin ID and installation
directory must match (`katakit-text-starter`). Restart Obsidian if the newly
copied plugin does not appear immediately. Only `dist/` files are installed;
`vendor/` and `node_modules/` are build-time dependencies, not vault assets.

Inside the Katakit workspace, use `node scripts/check-template-manifests.mjs`
and `node scripts/check-template-copy.mjs obsidian` from the repository root.
The latter makes an independent copy and runs `pnpm install` and `pnpm build`
there. The root `pnpm templates:check` and `pnpm templates:copy-check obsidian`
commands also work once the workspace installation is current; when adding a
template without updating the root lockfile, pnpm 11 may try to resolve the
unpublished Katakit packages against npm before it starts those scripts.

## How it works

`src/session.ts` creates a Katakit instance with transcript ingestion, sends
supplied text as a finalized segment, then flushes it to a conversation turn.
`src/main.ts` owns the Obsidian view, textarea, sample, status and subscription;
it closes the session when the view closes. `build.mjs` creates Obsidian's
CommonJS `main.js` and copies the manifest. Replace the sample/textarea input
first when adapting this starter to another text source. No platform permission
is requested. Empty input shows a validation message instead of creating a turn;
build failures are printed by `pnpm build`.

Manual check: add the sample, verify it appears as a turn, add a second line,
then submit whitespace and confirm the error appears without a new turn. Close
and reopen the view to confirm the in-memory transcript is gone. Obsidian
Desktop runtime smoke testing is **not yet verified**; install/build tests alone
do not prove the view works on the target platform. Mobile is not supported.

The unpublished Katakit packages are bundled as built tarballs under `vendor/`
from source revision `3dea321`. To refresh after changes to those packages,
build `pkgs/core` and `pkgs/transcript-ingestion` at the desired revision, then
run `pnpm pack --out ../../templates/obsidian/vendor/katakit-core-0.0.0.tgz`
from `pkgs/core` and the corresponding
`pnpm pack --out ../../templates/obsidian/vendor/katakit-transcript-ingestion-0.0.0.tgz`
from `pkgs/transcript-ingestion`. The packed files contain `dist/`, LICENSE,
README and package metadata; inspect them before distributing. The local
override resolves transcript ingestion's core dependency to its bundled
tarball. Once published, replace both with registry versions.

For shared APIs, see the [Katakit reference](https://katakit.dev/reference/).
