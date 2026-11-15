# katakit

Workspace packages expose their public APIs through package-root imports:
`@katakit/core`, `@katakit/event-log`, and `@katakit/persistence`. React bindings
are reserved under `@katakit/react` and are not implemented yet.

## Development

- `pnpm tsc` checks every package, including tests, using its own `tsconfig.json`.
- `pnpm test:ci` runs workspace tests.
- `pnpm build` builds each library's JavaScript and declarations and the docs site.

Package configs select the `source` export condition for typechecking. Event-log
and persistence tests also select it, so editing core requires no intervening
build. Vite consumers can select it through `resolve.conditions` and, for SSR,
`ssr.resolve.conditions`. Default package imports use the built `dist/` entry.

There is no root TypeScript config or workspace source-path alias.

## Documentation site

The documentation site lives in `docs/`, with Getting started, Concepts, and
Reference pages. Run `pnpm docs:dev` to preview it locally or `pnpm docs:build`
to generate `docs/dist/` for a static host. Pages in `docs/pages/` define the
navigation hierarchy; each section's `README.md` is its landing page. Run
`pnpm --filter @katakit/docs exec node scripts/generate-nav.mjs` after adding
or moving a page, and commit `docs/src/nav.json`. `pnpm docs:check` checks
generated navigation, local Markdown links, and tests. The static host must
serve `docs/dist/index.html` for unknown paths to support direct page URLs.

## Demo gallery

Run `pnpm gallery:dev` for the demo index and individual demo pages, or
`pnpm gallery:build` to build the static site. See [demos/gallery/README.md](demos/gallery/README.md)
for adding demos and the hosting requirements for microphone transcription.
The [Chrome extension template](templates/chrome-extension/README.md) is a minimal
audio-capable host. The [conversation bingo demo](demos/bingo-extension/README.md)
shows it in use as a Chrome side-panel game.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
