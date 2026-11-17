# Contributing to Katakit

Thanks for helping Katakit grow. You can contribute by trying an example and sharing
what happened, improving the docs, fixing a bug, or building a plugin, integration, or demo.
You don't need to write code to help.

## Find something to work on

- **Something isn't working?** [Report a bug](https://github.com/katabase-ai/katakit/issues/new?template=bug_report.md).
  Tell us what you expected, what happened, and how we can reproduce it.
- **Have an idea?** [Request a feature](https://github.com/katabase-ai/katakit/issues/new?template=feature_request.md)
  or [propose an integration](https://github.com/katabase-ai/katakit/issues/new?template=integration_proposal.md).
  Describe what you'd like to build and how the change would help.
- **Want to help with an existing task?** Browse the [open issues](https://github.com/katabase-ai/katakit/issues)
  and leave a comment on one you're interested in.
- **Found a small fix?** You can open a pull request directly for a typo, documentation
  improvement, or focused bug fix. For a larger change, open an issue first so we can
  discuss the approach before you invest time in it.

If you're unsure where to start, email [katakit@katabase.com](mailto:katakit@katabase.com).
Tell us what interests you, and we can work out a useful next step together.

## Set up locally

You'll need Git, Node.js 24+, and pnpm 11.9.0. Clone the repository and create a branch:

```sh
git clone https://github.com/katabase-ai/katakit.git
cd katakit
git switch -c your-change
pnpm install --frozen-lockfile
```

If you're contributing from a fork, use your fork's clone URL instead. If you can't
create a branch or fork, email us so we can help you get started.

To explore the demos, start the gallery:

```sh
pnpm -F @katakit/gallery dev
```

Open the local URL printed in your terminal. The [gallery README](examples/demos/gallery/README.md)
covers microphone setup and the demos' other requirements. To work on an independent
application starter, follow its own README; starters install and run from their own directories.

## Make your change

Keep your first pull request focused on one problem. These are good places to look:

| You want to change…          | Start here                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A guide or explanation       | [`docs/pages/`](docs/pages/) and the [docs editing instructions](docs/AGENTS.md)                            |
| A demo or its UI             | [`examples/demos/`](examples/demos/) and that demo's README                                                 |
| An application starter       | [`examples/starters/`](examples/starters/) and the [starter contributor guide](examples/starters/README.md) |
| A reusable package or plugin | [`pkgs/`](pkgs/) and the [library contributor guidance](pkgs/AGENTS.md)                                     |

Read the `AGENTS.md` instructions in the area you change; they contain engineering
conventions for everyone working in that area. The [development reference](DEVELOPMENT.md)
has details on package layout, imports, and example packaging when you need them.

Update relevant docs or examples when behavior changes. Add or update tests that demonstrate
a bug fix or new behavior, and try visible UI changes in the affected application.

## Check your work

Run the checks appropriate to your change from the repository root. For example:

```sh
# Format changed Markdown or source files; replace these paths with yours.
pnpm exec oxfmt path/to/changed-file.md

# Check types across the workspace after a code change.
pnpm tsc

# Run a package's tests, if it defines a test:ci script.
pnpm --filter @katakit/core test:ci
```

For docs changes, follow the [documentation checks](docs/AGENTS.md#verification).
For demo or starter changes, use the [example verification instructions](examples/AGENTS.md)
to check that your example still works outside the workspace.
For package releases, follow the [release setup and verification](.github/RELEASING.md).

`pnpm check` runs the full repository checks. See the [check reference](DEVELOPMENT.md#checks)
for individual commands. If you can't run a relevant check, explain what you tried and
what remains unverified in your pull request.

## Submit a pull request

Commit your changes, push your branch to GitHub, and open a pull request against `main`.
In the description:

- Explain the problem and what your change does.
- Link related issues.
- List the checks you ran and their results.
- Include screenshots or a short recording for visible UI changes.

You can open a draft pull request if you'd like feedback while you're still working.
Keep the discussion on the issue or pull request so others can follow along, and push
follow-up commits to the same branch when addressing review feedback.
