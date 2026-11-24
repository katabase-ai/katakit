# Export documentation

Katakit owns authored pages in `docs/pages/` and public API declarations/JSDoc in
`pkgs/*/src/`. The exporter combines these into portable Markdown and a manifest.
The [Katabase website](https://github.com/katabase-ai/protozoa-app/tree/main/pkgs/website)
consumes that bundle and owns its routes, HTML, search, styling, and deployment.
See [the contributor instructions](AGENTS.md) for editing and validation.

## Commands and outputs

Run these commands from the repository root after installing workspace dependencies.

| Command                       | Output            | Contents                                                              |
| ----------------------------- | ----------------- | --------------------------------------------------------------------- |
| `pnpm -F @katakit/docs dev`   | Local Vite viewer | Authored pages only, without generated API reference                  |
| `pnpm -F @katakit/docs build` | `docs/dist/`      | Static build of that same viewer                                      |
| `pnpm docs:export`            | `dist/docs/`      | Portable authored pages, generated API Markdown, assets, and manifest |
| `pnpm -F @katakit/docs check` | Validation only   | Navigation freshness, authored links, and guide tests                 |

Run `pnpm -F @katakit/docs-export test:ci` for the exporter tests. The root
`pnpm check` includes both sets of documentation tests.

To choose another export directory, run
`pnpm docs:export --output /absolute/path`. Export replaces the destination directory;
use a directory reserved for generated output. It does not render HTML. The local
viewer reads `docs/pages/` directly, so exporting does not add API pages to it.
When hosting the viewer build, serve `docs/dist/index.html` for unknown paths to
support direct page URLs. This SPA fallback belongs to the viewer; the website
consumer separately generates HTML for individual documentation pages.

## Package coverage

Generated API reference covers `@katakit/core`, `@katakit/event-log`,
`@katakit/persistence`, `@katakit/transcript-ingestion`, `@katakit/transcription`,
and `@katakit/react`. The package list is explicit in
[`exportDocs.mjs`](../internal/pkgs/docs-export/exportDocs.mjs), not discovered from every
workspace package. Private build tools, site UI, demos, and starters are outside
generated API coverage; authored pages can still explain them.

For a new public package, add it to that list and to
[`tsconfig.reference.json`](../internal/pkgs/docs-export/tsconfig.reference.json). Define its
public entry points through the package manifest's `exports` and `source`
conditions, then run `pnpm docs:export` and inspect the manifest's `packages` and
generated pages. Each selected package's public code subpaths are included
automatically, including transcription's browser, asset, Vite, and recognizer
entry points. JSON metadata exports are recorded separately in `nonCodeExports`.

`internal/pkgs/docs-export` owns API extraction with TypeDoc 0.28.20, its Markdown plugin 4.14.1,
and supported TypeScript 6.0.3. Application checking remains on TypeScript 7. Export validates
actual public package entry points and guide links, and fails conversion errors.
React devtools are covered by the `@katakit/react` entry point.

## Bundle contract

The portable output has `manifest.json` format version 1 and a `content/` tree of Markdown and
documentation assets. All manifest paths are relative to the bundle directory. Pages contain
`slug`, `kind`, `title`, `file`, heading IDs, and an authored `sourcePath` where applicable.
`kind: "guide"` covers all authored pages, including handwritten Reference pages;
`kind: "api"` identifies generated API reference.
`navigation` contains authored pages, with Application Starters above the package-named Reference section. Generated API
pages remain in `pages` for existing links and public-export coverage, without sidebar entries.
Navigation placement does not change page slugs or relative content links.
`packages` records each public
entry point and its exported symbol names. `assets` lists exported documentation files. `nonCodeExports` records package metadata
exports that do not expose TypeScript declarations; these are not invented API pages. The
transcript-ingestion package is documented separately from the speech transcription utilities.

The manifest records the actual Git revision, dirty state, exact extraction tool versions, and
extraction/total export timings in milliseconds. Consumers must verify provenance before
publishing; development output from a dirty checkout is visibly different from a pinned CI input.

Markdown links are relative to other exported Markdown files; GitHub source links pin the source
revision. Consumers choose their URL prefix, presentation, HTML compiler, search, and deployment.
No Fumadocs component, private website primitive, source checkout, or credential belongs in this
bundle. Exporting one revision does not establish historical-release publication.
