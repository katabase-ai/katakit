# Documentation

This directory owns Katakit's authored documentation and its local Vite viewer.
`pages/` contains Getting started, Concepts, and authored Reference pages;
`src/` renders the exported guide/API bundle; `scripts/` integrates the export with
Vite, generates authored navigation, and checks links.
`../pkgs/docs-export/` combines these pages with generated API reference for
website consumers. See [EXPORT.md](EXPORT.md) for that boundary and bundle contract.

## Editing

- Write introductions and task instructions in `pages/getting-started/`, shared
  concepts in `pages/concepts/`, and behavior, lifecycle, configuration, and
  examples in `pages/reference/`.
- Describe public symbols beside their source declarations with JSDoc. The
  exporter generates signatures, types, and symbol pages from those declarations;
  edit the source rather than the generated Markdown.
- Plugin reference has two parts. Keep the purpose, a complete factory/configure/
  register/start/use example, dependencies, lifecycle limits, and related concepts
  in the authored Reference page. Describe options and exposed members beside
  their declarations with JSDoc. Do not copy signatures into a second generated page.
- For concrete factories returning `KatakitPlugin`, the exporter adds Factory
  options, Configuration, Observables, and Methods sections to the generated API
  page. It derives fields, optional markers, generic types, and descriptions from
  the same compiler used for export coverage. Empty collections are stated explicitly;
  the complete TypeDoc reference follows these sections. The local viewer and PR
  previews display these pages alongside authored documentation.
- Keep package README files focused on package setup and entry points; link to
  authored pages for extended explanations instead of maintaining duplicate prose.
- Each page needs a level-one title. Directories define sections; a section's
  `README.md` is its landing page. Link to other authored pages with relative
  Markdown paths and heading anchors. Images belong in `public/`.
- After adding, moving, or retitling a page, run
  `pnpm --filter @katakit/docs exec node scripts/generate-nav.mjs` from the repository
  root and commit `src/nav.json`. Root section order is defined in that script;
  children are ordered by filename, with pages before subsections.

## Verification

Run commands from the repository root after installing workspace dependencies.

1. Run `pnpm -F @katakit/docs check` for navigation freshness, authored links, and
   guide tests, and `pnpm -F @katakit/docs-export test:ci` for export tests.
2. Run `pnpm -F @katakit/docs dev` to review guides and generated API reference.
   It exports on startup and rebuilds after guide, asset, public TypeScript/JSDoc,
   package manifest, or exporter changes. Changes during an export are queued; errors
   appear in Vite's overlay while the last successful pages remain available.
   This viewer has its own presentation; it does not build the consuming website.
3. Run `pnpm docs:export` to validate the combined guide/API bundle, public-symbol
   coverage, and exported links/anchors. Review `dist/docs/manifest.json` and
   Markdown under `dist/docs/content/`. Run `pnpm -F @katakit/docs build` to build
   the same complete viewer deployed by the PR preview workflow.

Commit authored pages, source JSDoc, and generated `src/nav.json`. Exported bundles
(`../dist/docs/`), the viewer's export staging directory (`../.tmp/docs-viewer-*/`),
and the viewer build (`dist/`) are ignored build output.
For a new public package, follow the coverage procedure in [EXPORT.md](EXPORT.md#package-coverage).
