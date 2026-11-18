# Internal tooling and assets

Use the [placement table](../DEVELOPMENT.md#package-structure) and
[internal sharing contract](../DEVELOPMENT.md#internal-tools-and-shared-styles).

- Dependency-owning build tools live in `pkgs/<name>/` with `private: true`.
  Preserve supported root commands and portable output contracts when moving implementation.
- `site-ui/` contains only regular CSS files. Do not add a manifest, React wrapper, or audio
  processing code there. Consumers own controls and capture behavior. Keep portable component
  styles scoped without a global reset; let the host own typography, colors, and markup.
- For CSS changes, build docs and gallery and run `pnpm demos:copy-check gallery`; the copy tool
  must materialize every imported stylesheet. Portable gallery CSS must not import a page reset.
- The documentation exporter has its own [instructions](pkgs/docs-export/AGENTS.md).
  Its supported compiler and manifest/link/provenance checks remain authoritative.
