# Releasing Katakit

Public packages under `pkgs/` have independent versions. Use the repository's
[`release` skill](../.agents/skills/release/SKILL.md) to propose changelogs and version bumps,
obtain agreement, and prepare a PR. Release branches are `release/YYYY-MM-DD-N`, with PR
titles such as `Release 2026-11-17-1`. Only stable `x.y.z` releases to npm's `latest` dist-tag
are supported by this workflow.

## One-time repository setup

A maintainer configures the GitHub Actions repository secret `NPM_TOKEN` with an npm granular
access token permitted to publish the intended `@katakit` packages. It needs write access and
noninteractive publishing permission (bypass 2FA), with permission to create packages when
making an initial publication. Renew the secret before the token expires.

The workflow maps that secret to `NODE_AUTH_TOKEN` only for the publish step. Node setup
configures authentication for `https://registry.npmjs.org`. Publication uses token
authentication. GitHub's automatic `GITHUB_TOKEN`, exposed to the CLI as `GH_TOKEN`, needs
`contents: write` to push package tags and create releases; repository rules must allow those
operations. No personal GitHub token is required.

These are configuration names and permission requirements, not credentials. Keep token values,
account-specific configuration, and authentication output out of tracked files, PRs, and logs.

## Release PR contents

For each selected package:

- Increase `version` in `pkgs/<name>/package.json`.
- Add a nonempty `## <version>` section to `pkgs/<name>/CHANGELOG.md`. GitHub releases use
  this section as their release notes.
- Refresh the workspace lockfile as needed. Preserve `workspace:^` peers; pnpm replaces
  those with registry caret ranges when packing.

The skill shows the user the proposed notes and versions before making these changes.
Include initial dependencies in the release if their required versions are not on npm.
An unchanged package is not published, even when its source has changed.

Before merge, run `pnpm check`, `pnpm examples:copy-check`, and, after committing:

```sh
pnpm release:plan origin/main HEAD
pnpm release:pack origin/main HEAD
```

`release:plan` reads committed manifests and notes. `release:pack` builds and packs the
selected libraries, verifies exported files, README/license inclusion and rewritten dependency
ranges, and checks Katakit dependency availability. It performs public npm lookups but does
not publish. These commands require Git, Node, pnpm, npm, and tar.

PR CI validates version increases and changelog sections. Use the usual required checks and
PR review before merging. Merge one release PR at a time and wait for successful publication
before merging another; GitHub concurrency retains only one pending run.

## What happens on merge

`Release npm packages` runs when a push to `main` changes a public package manifest. It compares
the push's `before` SHA with its exact resulting SHA, so squash, merge, and rebase merges work
without relying on PR titles or labels. An unchanged version is a no-op; a downgrade fails.
New public packages must have a nonzero initial version and release notes.

CI checks out that exact SHA, runs the contributor and standalone-copy checks, and packs only
the selected packages with pnpm. It validates all archives and existing versions/tags before
publishing, then publishes dependency-first using the npm token. Private packages are excluded.

After every selected package is available on npm with the expected archive integrity, CI pushes
all package tags atomically. Each tag, such as `@katakit/core@0.1.0`, points to the merged SHA,
not a later main commit. It then creates one public GitHub release per tag. Package releases
do not compete for GitHub's repository-wide “latest release” designation.

## Recovery

Re-run the original failed workflow from GitHub Actions. It retains the same before/release
SHAs even if main has moved. Publishing jobs are serialized and active runs are not cancelled
by newer pushes.

- Already published versions are skipped only when their registry archive integrity matches
  the freshly packed archive. Network/authentication errors fail; only npm `E404` means absent.
- A tag that already points to the release SHA is reused. A tag pointing elsewhere is an error.
- Missing GitHub releases are created; existing published stable releases are reused.

If npm succeeds for some packages and later publication fails, those npm versions remain
published. Tags are created only after the entire selected set has succeeded. If GitHub release
creation fails after tagging, rerunning finishes the missing releases.

Never move a conflicting version tag or try to overwrite an npm version. Investigate a content
mismatch (including a nondeterministic build) before retrying. A corrected npm artifact needs
a new version and a new release PR. The workflow cannot roll back npm publication.

## Update demos and starters afterward

Once npm publication succeeds, use the separate
[`update-examples` skill](../.agents/skills/update-examples/SKILL.md). It updates all demos and
starters in a follow-up PR and runs standalone checks against actual registry packages.
