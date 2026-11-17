# Examples

[Demos](demos/gallery/README.md) show complete features; [starters](starters/README.md)
provide a small application for a particular platform. Each example owns its setup instructions.
Demos participate in the root workspace; starters are independent pnpm projects.

To prepare a standalone copy from an installed checkout:

```sh
pnpm examples:copy demos/transcription-react /tmp/my-transcriber
# Or: pnpm examples:copy starters/react-web /tmp/my-app
cd /tmp/my-transcriber
pnpm install
pnpm build
pnpm dev
```

The command refuses existing destinations and copies regular files, excluding local credentials,
installed dependencies, and generated output. Demos receive built library tarballs in `vendor/`
and local overrides until Katakit is published. The gallery also receives the demo source it
composes. Starters already include their own tarballs. Keep all files in the resulting directory
when moving it again; it needs no source checkout. Follow each README for run commands,
extension installation, model downloads, microphone permissions, and hosting headers.

Run `pnpm examples:copy-check` to install, build, and test all copies in temporary directories.
This verifies dependency and asset portability; real microphone/model and platform behavior
still need the manual checks described in each README.
