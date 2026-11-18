# Examples

[Demos](demos/gallery/README.md) show complete features; [starters](starters/README.md)
provide a small application for a particular platform. Each example owns its setup instructions.
Demos participate in the root workspace; starters are independent pnpm projects.

Standalone examples install Katakit packages from npm.

To prepare a standalone copy from a checkout:

```sh
pnpm examples:copy demos/transcription-react /tmp/my-transcriber
# Or: pnpm examples:copy starters/react-web /tmp/my-app
cd /tmp/my-transcriber
pnpm install
pnpm build
pnpm dev
```

`pnpm demo:export <name> <destination>` is shorthand for `pnpm examples:copy demos/<name> <destination>`.
The checkout shares the Bingo module and meter/base CSS through relative symlinks to the
browser Bingo demo. Use a symlink-enabled checkout and export rather than copying a raw demo folder.
Both commands materialize these links as regular files and reject unexpected links.
The command refuses existing destinations and excludes local credentials,
installed dependencies, and generated output. The gallery copy includes the demo source and
shared CSS it composes. Keep all files in the resulting directory when moving it again.
Follow each README for run commands,
extension installation, model downloads, microphone permissions, and hosting headers.

Run `pnpm examples:copy-check` from an installed checkout to build and pack the current libraries,
then install, build, and test all examples against those packages in temporary directories.
Real microphone/model and platform behavior still need the manual checks described in each README.
