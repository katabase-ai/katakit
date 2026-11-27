# Examples

[Demos](demos/) show complete features; [starters](starters/README.md)
provide a small application for a particular platform. Each example owns its setup instructions.
Demos participate in the root workspace; starters are independent pnpm projects.
The [gallery](../gallery/README.md) is a separate host that composes the demos.
For reusable feature-demo code conventions, see [Copyable feature examples](demos/AGENTS.md);
each demo's own guide covers its setup and manual checks.

Standalone examples install Katakit packages from npm.

To prepare a standalone copy from a checkout:

```sh
pnpm examples:copy demos/transcription /tmp/my-transcriber
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
Follow each README for run commands, model downloads, microphone permissions, and
hosting headers. The Bingo, transcription, and Color Clash READMEs link to their
standalone `AGENTS.md` files for these details.

Run `pnpm examples:copy-check` from an installed checkout to build and pack the current libraries,
then install, build, and test all examples and the gallery against those packages in temporary directories.
Real microphone/model and platform behavior still need the manual checks described in each example's guide.

## Maintaining conversation bingo

The Bingo demo's short README links to its `AGENTS.md`, which owns standalone setup,
organization, and manual checks. Repository-only maintenance belongs here.

From an installed checkout, build the libraries with `pnpm build:pkgs`, then run
`pnpm -F @katakit/demo-bingo dev`. Prepare an independent copy with
`pnpm examples:copy demos/bingo <destination>` and follow its `AGENTS.md`.

Browser tests live in `examples/demos/bingo/tests/`. The demo owns its Bingo behavior
and presentation; there is no extension copy to synchronize.

Verify browser-demo changes with `pnpm demos:copy-check bingo` and changes to
gallery consumption with `pnpm gallery:copy-check`.

## Maintaining local transcription

The transcription demo's short README links to its `AGENTS.md`, which owns standalone
setup, organization, and manual checks.

From an installed checkout, build the libraries with `pnpm build:pkgs`, then run
`pnpm -F @katakit/demo-transcription dev`. Prepare an independent copy with
`pnpm examples:copy demos/transcription <destination>` and follow its `AGENTS.md`.

Verify demo changes with `pnpm demos:copy-check transcription` and changes to
gallery consumption with `pnpm gallery:copy-check`. Gallery adapters and introductions
belong in `gallery/shared/`; keep those concerns out of the copied demo.

## Maintaining Color clash

The [Color Clash README](demos/color-clash/README.md) links to its local
`AGENTS.md` for standalone setup, organization, and manual checks. From an
installed checkout, build the libraries with `pnpm build:pkgs`, then run
`pnpm -F @katakit/demo-color-clash dev`. Prepare an independent copy with
`pnpm examples:copy demos/color-clash <destination>`.

Verify demo changes with `pnpm demos:copy-check color-clash` and gallery
consumption with `pnpm gallery:copy-check`. Keep gallery capture in its adapter;
the copy owns its own input and shutdown.
