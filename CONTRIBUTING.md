# Contributing to Katakit

Try an example, change an interaction, or help improve a reusable building block. Share bugs,
questions, and examples through [GitHub issues](https://github.com/katabase-ai/katakit/issues).
When proposing a change, explain the behavior it enables and how you checked it.

## Set up the workspace

Use Node.js 24+ and pnpm 11.9.0, as declared in `.node-version` and `package.json`:

```sh
pnpm install --frozen-lockfile
```

Public libraries live in `pkgs/`; applications and feature examples live in `examples/demos/`.
The copyable `examples/starters/` are independent pnpm projects, outside the root workspace.
Follow the selected template's README and run its commands from its own directory.

The libraries are currently unpublished. Examples copied outside the repository need built
Katakit packages; starter directories carry their own `vendor/` tarballs. Follow the relevant
README when copying a demo or rebuilding those archives.

## Checks

Run commands from the repository root:

| Command                    | Purpose                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm tsc`                 | Check each workspace package, including its tests, with its own TypeScript config.         |
| `pnpm test:ci`             | Run workspace tests.                                                                       |
| `pnpm build`               | Build library JavaScript/declarations, demos, and the docs viewer.                         |
| `pnpm check`               | Run formatting, lint, licenses, template manifests, types, tests, docs checks, and builds. |
| `pnpm docs:export`         | Validate and export authored docs and generated API reference.                             |
| `pnpm examples:copy-check` | Copy, install, build, and test every demo and starter outside the workspace.               |

For focused work, use `pnpm --filter <package-name> <command>`. Before submitting, run the
checks appropriate to the change; the CI workflow runs the full set. For template changes,
also follow the manual platform checks in [examples/starters/README.md](examples/starters/README.md).

## Package imports and TypeScript

Import public APIs through package entry points such as `@katakit/core`,
`@katakit/event-log`, and `@katakit/transcription/browser`. Default imports resolve to built
`dist/` entries. Package configs select the workspace-only `source` export condition for
typechecking. Event-log and persistence tests select it too, so editing core does not require
an intervening build.

Vite consumers can select workspace source through `resolve.conditions` and, for SSR,
`ssr.resolve.conditions`. Keep that development choice separate from testing built or packed
packages. There is no root TypeScript config or workspace source-path alias; each project owns
its configuration.

Use [React-RxJS](docs/pages/getting-started/react.md) for React subscriptions to runtime
observables. The optional microphone ownership hook is exported from
`@katakit/transcription/react`; `@katakit/react` remains reserved for future APIs.

## Stateful plugins

Official stateful plugins must use `@katakit/event-log` as the source of application state and
derive that state from its events. Keep recognition utilities independent: they do not need to
instantiate a plugin runtime or event log. Persistent storage remains an application choice.

## Documentation

Katakit owns authored documentation in `docs/pages/` and API descriptions in public source
declarations and JSDoc. `pnpm docs:export` combines both into a portable Markdown bundle.
The consuming website owns HTML, search, styling, and deployment.

```sh
pnpm -F @katakit/docs dev
```

The local viewer previews authored pages only; it does not include generated API reference.
See [docs/AGENTS.md](docs/AGENTS.md) for editing and verification instructions and
[docs/EXPORT.md](docs/EXPORT.md) for commands, package coverage, and the export contract.
Keep the root README focused on understanding and trying Katakit; put detailed behavior in
the authored docs and setup instructions in the relevant package or application README.

## Internal tools and shared styles

`internal/packages/` contains private workspace build tools. The documentation producer is
`internal/packages/docs-export`; its public command remains `pnpm docs:export` and its portable
output contract remains in [docs/EXPORT.md](docs/EXPORT.md).

`internal/site-ui/` is plain CSS, with no manifest or JavaScript. The docs viewer and gallery
import it by relative path. `components.css` has control/meter styles without a page reset;
`styles.css` adds the local viewers' theme and reset. Gallery controls own their native markup
and behavior; microphone PCM activity belongs to the transcription input and the extension's
local capture helper. Feature demos and starters continue to own their small local UI copies.

For standalone gallery copies, `examples:copy` materializes the CSS under `styles/` and rewrites
only the copied imports. Straightforward duplication keeps feature examples directly usable;
the composed gallery's copy workflow carries its extra inputs. Symlinks require checkout support
and are not a portable download contract; a shared React package would add a UI dependency to
examples intended to be modified independently. No global source/CSS synchronization is required.

## Demos and starters

Run the local gallery with:

```sh
pnpm -F @katakit/gallery dev
```

The [gallery README](examples/demos/gallery/README.md) covers adding entries, building the host,
shared input ownership, model connections, and microphone hosting requirements.
The [starter guides](docs/pages/starters/README.md) help users choose a platform;
[template contributor guidance](examples/starters/README.md) defines copyability and verification.

The [browser bingo](examples/demos/bingo-react/README.md) and
[extension bingo](examples/demos/bingo-extension/README.md) examples each own their UI, styling, board
state, and audio host so they can be copied independently. Their READMEs explain standalone
setup. Bingo behavior is maintained in `examples/demos/bingo-react/src/bingo/` and copied into the
extension; `pnpm bingo:check-copy` checks that those copies agree.

## Website source consumers

A pinned website must update its source aliases when adopting this layout. In Protozoa's
`pkgs/website`, change `.katakit/source/demos/gallery/shared` to
`.katakit/source/examples/demos/gallery/shared` in both `tsconfig.json` and `vite.config.ts`.
Source links must use `examples/demos/` too. Adopt the new source SHA together with those
changes; existing pins keep their old layout. `prepareKatakitRuntime.mjs` still builds libraries
under `pkgs/`, and `prepareDocs.mjs` still invokes `pnpm docs:export`.
The open Color Clash PR also needs its new gallery files moved beneath `examples/demos/`
when rebased; this structural change does not incorporate that feature.

## Pull request previews

Pull requests build standalone docs and gallery previews. Same-repository PRs upload them
to Cloudflare Workers and receive preview links in PR comments. Fork PRs build without
uploading or commenting. See [preview setup and verification](.github/PREVIEWS.md) for the
required account, token, initial deployments, and review steps.
