# Examples

[Demos](demos/) show complete features; [starters](starters/README.md)
provide a small application for a particular platform. Each example owns its setup instructions.
Demos participate in the root workspace; starters are independent pnpm projects.
The [gallery](../gallery/README.md) is a separate host that composes the demos.

Standalone examples install Katakit packages from npm.

To prepare a standalone copy from a checkout:

```sh
pnpm examples:copy demos/transcription-react /tmp/my-transcriber
# Or: pnpm examples:copy starters/react-web /tmp/my-app
# Or: pnpm examples:copy gallery /tmp/my-gallery
cd /tmp/my-transcriber
pnpm install
pnpm build
pnpm dev
```

The command refuses existing destinations and copies regular files, excluding local credentials,
installed dependencies, and generated output. The gallery copy includes the demo source and
shared CSS it composes. Keep all files in the resulting directory when moving it again.
Follow each README for run commands,
extension installation, model downloads, microphone permissions, and hosting headers.

## Maintaining conversation bingo

The Bingo demo's short README links to its `AGENTS.md`, which owns standalone setup,
organization, and manual checks. Repository-only maintenance belongs here.

From an installed checkout, build the libraries with `pnpm build:pkgs`, then run
`pnpm -F @katakit/demo-bingo-react dev`. Prepare an independent copy with
`pnpm examples:copy demos/bingo-react <destination>` and follow its `AGENTS.md`.

`examples/demos/bingo-react/src/bingo/` is the canonical implementation shared with
`examples/demos/bingo-extension/src/bingo/`. Keep both local copies, including their
tests and module README, identical. Run `pnpm bingo:check-copy` after canonical edits.
The extension remains independently copyable; its UI is maintained separately.

Verify browser-demo changes with `pnpm demos:copy-check bingo-react` and changes to
gallery consumption with `pnpm gallery:copy-check`.

Run `pnpm examples:copy-check` from an installed checkout to build and pack the current libraries,
then install, build, and test all examples and the gallery against those packages in temporary directories.
Real microphone/model and platform behavior still need the manual checks described in each README.
