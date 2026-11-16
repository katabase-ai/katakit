# katakit

Workspace packages expose their public APIs through package-root imports:
`@katakit/core`, `@katakit/event-log`, and `@katakit/persistence`. React applications
should use [React-RxJS bindings](docs/pages/getting-started/react.md) to render
runtime observables. `@katakit/react` is reserved for future React-specific APIs.

The standalone [`@katakit/transcription`](pkgs/transcription/README.md) package supplies Moonshine/Whisper
recognition, a browser microphone helper, and WASM/worker asset setup without React or
a plugin-system dependency.

## Development

- `pnpm tsc` checks every package, including tests, using its own `tsconfig.json`.
- `pnpm test:ci` runs workspace tests.
- `pnpm build` builds each library's JavaScript and declarations and the docs site.

Package configs select the `source` export condition for typechecking. Event-log
and persistence tests also select it, so editing core requires no intervening
build. Vite consumers can select it through `resolve.conditions` and, for SSR,
`ssr.resolve.conditions`. Default package imports use the built `dist/` entry.

There is no root TypeScript config or workspace source-path alias.

Pull requests build standalone docs and gallery previews. Same-repository PRs
upload them to Cloudflare Workers and get preview links in PR comments. See
[preview setup and verification](.github/PREVIEWS.md) for the required account,
token, and initial Worker deployments.

## Documentation

Katakit owns authored documentation in `docs/pages/` and API descriptions in
public source declarations and JSDoc. `pnpm docs:export` combines both into a
portable Markdown bundle; the Katabase website consumes it and owns HTML,
search, styling, and deployment.

`pnpm -F @katakit/docs dev` previews the authored pages locally; it does not include generated
API reference. See the [contributor instructions](docs/AGENTS.md) for editing and
checks, and the [export contract](docs/EXPORT.md) for commands, package coverage,
and the distinction between the local viewer and website publication.

## Demo gallery

Run `pnpm -F @katakit/gallery dev` for the demo index and individual demo pages, or
`pnpm -F @katakit/gallery build` to build the static site. See [demos/gallery/README.md](demos/gallery/README.md)
for adding demos and the hosting requirements for microphone transcription.
The [Chrome extension template](templates/chrome-extension/README.md) is a minimal
audio-capable host. The [conversation bingo demo](demos/bingo-extension/README.md)
shows it in use as a Chrome side-panel game.
The [browser bingo example](demos/bingo-react/README.md) and the extension
example each contain their own UI, styling, board state, and audio host. Each
example README documents how to copy it outside the repository, install its
dependencies, and run it independently.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
