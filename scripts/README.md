# Workspace structure checks

`pnpm lint` runs `check-workspace.mjs` and its tests after oxlint. The script uses
pnpm's workspace listing, so adding a package to `pnpm-workspace.yaml` brings it
under the check automatically.

- **Errors** fail lint: publishable packages need Apache-2.0 metadata and the
  package-local license text, workspace names must be unique, and `workspace:`
  dependencies must resolve.
- **Warnings** do not fail lint: package and template READMEs, package-local
  `AGENTS.md`, plugin and template reference pages, workspace dependency style,
  and publishable package metadata and entry-point conventions. These are
  rollout candidates; promote a rule to an error after existing packages comply.

Published packages under `pkgs/` are treated as plugins for reference-page
checks except `@katakit/core` and `@katakit/react`, which have different public
roles. If another role is added, update `nonPluginPackages` in the script.
Documentation content and link checks remain in `pnpm docs:check`.
