# Documentation

This directory owns Katakit's authored documentation and its local Vite viewer.
`pages/` contains Quickstart, Tutorial, Starters, and authored Reference pages;
`src/` renders them; `scripts/` generates navigation and checks links.
`../internal/pkgs/docs-export/` combines these pages with generated API reference for
website consumers. See [EXPORT.md](EXPORT.md) for that boundary and bundle contract.

## Editing

- Write introductions and task instructions in `pages/getting-started/`, guided
  conceptual walkthroughs in `pages/concepts/`, platform walkthroughs in `pages/starters/`,
  and reusable API behavior, lifecycle, configuration, and examples in
  `pages/reference/`. The copied `examples/starters/*/README.md` files own the exact
  install and run commands; docs pages explain how and why to adapt them.
- Describe public symbols beside their source declarations with JSDoc. The
  exporter generates signatures, types, and symbol pages from those declarations;
  edit the source rather than the generated Markdown.
- Keep package README files focused on package setup and entry points; link to
  authored pages for extended explanations instead of maintaining duplicate prose.
- Each page needs a level-one title. Directories define page URLs; a section's
  `README.md` is its landing page. Link to other authored pages with relative
  Markdown paths and heading anchors. Images belong in `public/`.
- After adding, moving, or retitling a page, run
  `pnpm --filter @katakit/docs exec node scripts/generate-nav.mjs` from the repository
  root and commit `src/nav.json`. Root section order is defined in that script;
  Tutorial follows its explicit learning order; other children are ordered by filename,
  with pages before subsections. Navigation groups
  the existing `starters` pages under Reference → Templates without changing their URLs.
  Standalone conceptual explanations belong in Reference; Tutorial teaches through use.

## Verification

Run commands from the repository root after installing workspace dependencies.

1. Run `pnpm -F @katakit/docs check` for navigation freshness, authored links, and
   guide tests, and `pnpm -F @katakit/docs-export test:ci` for export tests.
2. Run `pnpm -F @katakit/docs dev` to review authored pages in the local viewer. It does not
   preview generated API reference or the website's presentation.
3. Run `pnpm docs:export` to validate the combined guide/API bundle, public-symbol
   coverage, and exported links/anchors. Review `dist/docs/manifest.json` and
   Markdown under `dist/docs/content/`; use the consuming website to review the
   complete rendered documentation.

Commit authored pages, source JSDoc, and generated `src/nav.json`. Exported bundles
(`../dist/docs/`) and the viewer build (`dist/`) are ignored build output.
For a new public package, follow the coverage procedure in [EXPORT.md](EXPORT.md#package-coverage).
