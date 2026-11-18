# Demos and starters

Follow the [example contract](../DEVELOPMENT.md#add-or-change-an-example),
[copy workflow](README.md), and the selected example's README/scoped instructions.

- Demos use the root workspace; starters are independent projects with their own install settings.
  Run starter commands inside that starter, not with a root workspace filter.
- Keep feature demos and starters self-contained: native host setup, local UI, required assets,
  registry dependencies, and local application files. Do not add sibling imports, private
  workspace dependencies, or symlinks outside the shared demo sources listed in `scripts/demo-links.mjs`.
- Declare registry versions in example manifests. Copy checks test freshly packed libraries
  in temporary directories.
- Gallery composition is the documented exception. When adding an imported source or shared CSS,
  update its dependency manifest, copy inputs, and structural allowance together. Preserve the
  gallery's host input/model ownership and scoped presentation contracts.
- After changing imports, assets, config, or dependencies, run `pnpm demos:copy-check <name>` or
  `pnpm templates:copy-check <name>`. Run `pnpm demo:check-links` after shared source changes.
  Keep local credentials and generated output out of copies and commits.
- A copied build is not a native-platform or real-model test. Follow the README's manual checks
  when the interaction changes and report any unavailable environment explicitly.
