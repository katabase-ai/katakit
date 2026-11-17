# Development reference

Start with [Contributing to Katakit](CONTRIBUTING.md) for choosing a task, local setup,
and submitting a pull request. This reference covers package layout, public imports,
example packaging, and the checks needed for those changes.

Follow the repository's [engineering standards](AGENTS.md) and the `AGENTS.md` instructions
in the directory you change.

## Package structure

Choose placement by what the code ships and who owns its behavior:

| Location                    | Role and publication intent                                                      | Dependency boundary                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pkgs/<name>/`              | Libraries intended for publication as `@katakit/<name>`, even while unpublished. | Public libraries and registry dependencies at runtime; private build tools may be dev dependencies. |
| `internal/pkgs/<name>/`     | Private workspace build tools with their own dependency manifests.               | May read repository source and docs; expose build commands rather than application APIs.            |
| `internal/<purpose>/`       | Plain assets, with no workspace manifest. `internal/site-ui/` is CSS-only.       | Assets stay in their directory; consumers own markup and behavior.                                  |
| `examples/demos/<name>/`    | Private feature applications in the root workspace.                              | Ordinary library versions and local application files; no private workspace package dependencies.   |
| `examples/starters/<name>/` | Private, independently installed platform starters outside the root workspace.   | Registry dependencies and local application files; no outside files.                                |
| `docs/`                     | Authored guides and a private workspace viewer.                                  | Public APIs and plain internal CSS; the exporter owns the portable bundle.                          |

Root `scripts/` orchestrates repository checks and copying; use a private tool package when a
build tool needs its own dependencies. Do not turn an asset directory into a package merely to
share it. Public library source must not import applications, private tools, or internal assets.
Import other libraries through their public entry points, not relative sibling source paths.

Examples own their code, configuration, permissions, and small local UI. Use registry versions
in example manifests. Root workspace linking and root-only `workspace:*` overrides keep
local demo development on the checkout's libraries, including between a library release and
the follow-up update to example dependency versions. Add new public libraries to these
root overrides. Independent starters and standalone copies do not inherit the root settings.
The root build completes public libraries before building consumers, because pnpm's
recursive ordering can miss local dependency edges when registry pins differ from local versions.
No example source or asset may be a symlink. A feature demo or starter must not import sibling
examples or files elsewhere in the repository.

The gallery is an explicit composition exception: it imports the three feature demos' `src/`
directories and plain internal CSS. Its copy workflow carries those inputs as regular files and
rewrites the copied imports. When adding another gallery source input, update the gallery's
own dependencies, the copy inputs in `scripts/copy-example.mjs`, and the corresponding narrow
allowance in `scripts/check-structure.mjs`, then verify a standalone gallery copy.

### Add or change a library

1. Give it a versioned `@katakit/` name, public publication intent, a real Apache-2.0 `LICENSE`,
   README, and build/typecheck scripts. Ship built JavaScript and declarations through public
   `exports`; use a workspace-only `source` condition for development and strip it in
   `publishConfig.exports`. List distributable files explicitly. Match the existing library
   manifests and package smoke tests; building in the workspace does not prove a tarball works.
2. Declare runtime and development dependencies in the owning manifest. Katakit libraries use
   `workspace:^` peer dependencies for other Katakit libraries, with `workspace:*` development
   dependencies for local builds and tests. pnpm pack rewrites peer ranges to caret versions.
   Runtime dependencies on private tooling, applications, or local `file:`/`link:` paths are
   not publishable. Keep tests controlled
   and cover observable lifecycle/error behavior rather than duplicating implementation details.
3. Add public API descriptions beside declarations and follow
   [documentation package coverage](docs/EXPORT.md#package-coverage). Run affected standalone
   copy checks against freshly packed libraries; inspect what the packages contain.

### Add or change an internal tool

Put a dependency-owning tool under `internal/pkgs/` with `private: true`. Keep its output
rebuildable and ignored, and preserve documented root commands used by outside consumers.
For CSS sharing and the exporter, use the [internal tool and styling contract](#internal-tools-and-shared-styles).

### Add or change an example

Include its README, real LICENSE, build script, declared dependencies, platform files, and any
required runtime assets. Document exact install/run commands, input/model requirements, and
manual target-platform checks. A starter has its own `pnpm-workspace.yaml` and is run from its
own directory; never add it to the root workspace. Follow the detailed
[starter checklist](examples/starters/README.md) and the
[copy workflow](examples/README.md). Update the contributor test-package list in
`scripts/example-test-packages.mjs` if an example requires another Katakit package.

Run the relevant standalone copy check after changing imports, dependencies, configuration,
shared CSS, or runtime assets. A passing workspace build can hide a missing dependency or file.

## Checks

Run commands from the repository root:

| Command                    | Purpose                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm structure:check`     | Check package placement, publication intent, dependency boundaries, CSS-only assets, and example manifests; run negative fixtures. |
| `pnpm examples:check`      | Reject existing and symlink-routed copy destinations; verify an ordinary external copy.                                            |
| `pnpm tsc`                 | Check each workspace package, including its tests, with its own TypeScript config.                                                 |
| `pnpm test:ci`             | Run workspace tests.                                                                                                               |
| `pnpm build`               | Build library JavaScript/declarations, demos, and the docs viewer.                                                                 |
| `pnpm build:pkgs`          | Build all public libraries under `pkgs/` in dependency order.                                                                      |
| `pnpm publint`             | Lint all public libraries' pnpm-packed outputs; build first. Warnings fail the check.                                              |
| `pnpm check`               | Run formatting, lint (including structure), licenses, starter manifests, types, tests, docs checks, builds, and publint.           |
| `pnpm docs:export`         | Validate and export authored docs and generated API reference.                                                                     |
| `pnpm examples:copy-check` | Copy, install, build, and test every demo and starter outside the workspace.                                                       |

For focused work, use `pnpm --filter <package-name> <command>`. Before submitting, run the
checks appropriate to the change; the CI workflow runs the full set. For template changes,
also follow the manual platform checks in [examples/starters/README.md](examples/starters/README.md).
To check one copy, use `pnpm demos:copy-check gallery` or `pnpm templates:copy-check react-web`.
CI runs structural checks through lint and separately installs/builds/tests all demo and starter
copies against freshly packed local libraries. The structural checker examines manifests and
literal module/CSS imports; it is not a complete module resolver and does not evaluate computed
asset paths. Copy builds and the HTTP
worklet/isolation checks exercise those distributions. Microphone/model behavior and native
platform interaction still require the selected example's manual checks.

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

Use [React-RxJS](docs/pages/reference/react.md#react-rxjs-bindings) for React subscriptions to runtime
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

`internal/pkgs/` contains private workspace build tools. The documentation producer is
`internal/pkgs/docs-export`; its public command remains `pnpm docs:export` and its portable
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

## Package releases

Use the repository's [release skill](.agents/skills/release/SKILL.md) to present proposed
changelogs and version bumps, then prepare a release PR after agreement. Merging version bumps
publishes only the selected packages and creates package-specific tags and GitHub releases.
See [release setup and recovery](.github/RELEASING.md).

Once the versions are live on npm, the separate
[example update skill](.agents/skills/update-examples/SKILL.md) updates demos and starters.
Use `pnpm demos:copy-check --registry` and `pnpm templates:copy-check --registry` to verify
standalone copies against npm; the default copy checks use locally packed libraries.
