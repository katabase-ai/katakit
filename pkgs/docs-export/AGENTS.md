# Documentation export

This private build tool produces portable Markdown and a manifest for documentation consumers.
It never imports private website code or Fumadocs presentation.

- Use the package-local supported TypeScript compiler for TypeDoc; root application checking stays
  on its own compiler. Fail conversion errors rather than omitting broken public APIs.
  `#docs-export-compiler`
- Record the actual source revision and dirty state. Generated files are rebuildable output;
  authored guides and public declarations remain authoritative. `#docs-export-provenance`
- Keep manifest paths relative to the export directory, links portable, and public export coverage
  explicit. No source checkout or credentials belong in the bundle. `#docs-export-contract`
