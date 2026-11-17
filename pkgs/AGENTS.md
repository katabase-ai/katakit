# Publishable libraries

Follow [library standards](../CONTRIBUTING.md#add-or-change-a-library) and each package's scoped
instructions. A package here is intended for publication under `@katakit/`; private tooling
belongs in `internal/packages/`.

- Read the manifest's exports, source entry points, and callers before changing an API.
  Preserve built JavaScript/declaration entry points and the development-only source condition.
- Runtime source cannot import examples, docs, internal assets, or private tool APIs. Shared
  runtime behavior belongs in a publishable library with explicit dependencies.
- Typecheck and test the changed package; run `pnpm check` for packaged-library smoke tests
  and all consumers. Check transcription's package/runtime checks when changing its shipped assets.
- For added public packages/subpaths, follow [export coverage](../docs/EXPORT.md#package-coverage)
  and run `pnpm docs:export`. Update affected example archives/copy inputs when library source changes.
