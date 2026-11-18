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
selected libraries, runs strict publint on each resulting tarball, verifies exported files,
README/license inclusion and rewritten dependency ranges, and checks Katakit dependency availability.
It performs public npm lookups but does
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
publishing, including strict publint on the exact tarballs that will be published. A publint
warning or error stops the release before any package is published. CI then publishes
dependency-first using the npm token. Private packages are excluded.

After each upload, CI checks npm metadata every 15 seconds for up to ten minutes.
It logs progress and verifies the archive integrity before continuing. A successful upload
can take minutes to become visible through `npm view`, even after its version page or
tarball appears. Each lookup has a 15-second network timeout and disables npm's own
retries, so a final in-flight request can add up to 15 seconds to the visibility window.
Network/authentication failures and integrity mismatches stop immediately. The job's
90-minute timeout accommodates propagation for all six initial packages plus validation.

After every selected package is available on npm with the expected archive integrity, CI pushes
all package tags atomically. Each tag, such as `@katakit/core@0.1.0`, points to the merged SHA,
not a later main commit. It then creates one public GitHub release per tag. Package releases
do not compete for GitHub's repository-wide “latest release” designation.

## Recovery

For a transient failure, re-run the original failed workflow from GitHub Actions. It retains
the same before/release SHAs **and the old tooling**, even if main has moved.
Publishing jobs are serialized and active runs are not cancelled by newer pushes.

If recovery needs a tooling fix, merge the fix first, then manually run **Release npm packages**
from **main**. Supply the original push's full `base_sha` (before) and `release_sha` (resulting)
commit IDs, as recorded in the failed run. Do not substitute the new tooling commit for the
original release SHA. The workflow:

- Checks that the base is an ancestor of the release and the release is an ancestor of
  the selected main/tooling commit.
- Checks out the original release commit, preserving its package source, manifests,
  changelogs, lockfile, and build configuration.
- Uses only `scripts/release.mjs` from the selected tooling commit, then validates and
  packs the original snapshot. Package tags still point to the original release SHA.

The preparation step logs all three SHAs. Recovery does not require another version bump
when the archives match. The corrected runner must remain compatible with the original
snapshot's dependencies and check scripts.

- Already published versions are skipped only when their registry archive integrity matches
  the freshly packed archive. Network/authentication errors fail; only npm `E404` means absent.
- A tag that already points to the release SHA is reused. A tag pointing elsewhere is an error.
- Missing GitHub releases are created; existing published stable releases are reused.

If npm succeeds for some packages and later publication fails, those npm versions remain
published. Tags are created only after the entire selected set has succeeded. If GitHub release
creation fails after tagging, rerunning finishes the missing releases.

On a visibility timeout, check `npm view @katakit/<name>@<version>` before retrying.
A `0.0.0-stage` placeholder alone does not establish that maintainer approval is pending;
inspect the npm Staged Packages page if relevant. Do not approve, reject, or resubmit a
version just because metadata is still propagating.

Never move a conflicting version tag or try to overwrite an npm version. Investigate a content
mismatch (including a nondeterministic build) before retrying. A corrected npm artifact needs
a new version and a new release PR. The workflow cannot roll back npm publication.

## Update demos and starters afterward

Once npm publication succeeds, use the separate
[`update-examples` skill](../.agents/skills/update-examples/SKILL.md). It updates all demos and
starters in a follow-up PR and runs standalone checks against actual registry packages.
