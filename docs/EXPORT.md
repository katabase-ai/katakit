# Export documentation

Run `pnpm docs:export` from the repository root to write `dist/docs`. Pass
`--output /absolute/path` to choose an empty output directory; export replaces that directory.
Run `pnpm docs:check` for guide/export tests. The existing Vite viewer remains independent.

`pkgs/docs-export` owns API extraction with TypeDoc 0.28.20, its Markdown plugin 4.14.1,
and supported TypeScript 6.0.3. Application checking remains on TypeScript 7. Export validates
actual public package entry points and guide links, and fails conversion errors. React currently
has no public symbols; the manifest reports that without inventing an API page.

The portable output has `manifest.json` format version 1 and a `content/` tree of Markdown and
documentation assets. All manifest paths are relative to the bundle directory. Pages contain
`slug`, `kind`, `title`, `file`, heading IDs, and an authored `sourcePath` where applicable.
`navigation` retains guide order and groups API pages by package. `packages` records each public
entry point and its exported symbol names. `assets` lists exported documentation files. `nonCodeExports` records package metadata/asset
exports that do not expose TypeScript declarations; these are not invented API pages. The
transcript-ingestion package is documented separately from the speech transcription utilities.

The manifest records the actual Git revision, dirty state, exact extraction tool versions, and
extraction/total export timings in milliseconds. Consumers must verify provenance before
publishing; development output from a dirty checkout is visibly different from a pinned CI input.

Markdown links are relative to other exported Markdown files; GitHub source links pin the source
revision. Consumers choose their URL prefix, presentation, HTML compiler, search, and deployment.
No Fumadocs component, private website primitive, source checkout, or credential belongs in this
bundle. Exporting one revision does not establish historical-release publication.
