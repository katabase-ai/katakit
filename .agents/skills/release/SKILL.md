---
name: release
description: Propose Katakit package changelogs and version bumps, then prepare a release PR after the user agrees. Merging the PR publishes bumped packages through CI.
---

# Prepare a release PR

Paths below are relative to the repository root. Read `AGENTS.md`, `CONTRIBUTING.md`,
`.github/RELEASING.md`, and the scoped instructions for packages being released.

## Propose first

1. Inspect Git status and current `origin/main`; preserve unrelated work. Inventory public
   packages in `pkgs/*/package.json`. Review changes since each package's last
   `@katakit/<name>@<version>` tag, including relevant shared build/dependency changes.
   For an initial release, inspect the package's current implementation and public API.
2. Present the user with **the proposed changelog for each package**, its current and
   proposed version, and the reason for that bump. Use independently versioned stable
   `x.y.z` versions and describe breaking changes explicitly, including breaking changes
   before 1.0. Do not infer that every package needs a release.

   > Temporary policy: do not propose or apply major-version increases. New packages must
   > start at `0.x.y`; existing packages may receive only minor or patch bumps. Breaking
   > changes before 1.0 should use a minor bump with explicit migration notes. This is
   > enforced by `allowMajorBumps` in `scripts/release.mjs`. To lift the restriction later,
   > set that flag to `true`, update the temporary-policy test, and remove this note.

3. Review cross-package compatibility. `workspace:^` peers become caret ranges based on
   the dependency's version when packed. Check whether dependents need their own bump
   and whether every required Katakit dependency is already on npm or included in this
   proposal. Include any additional dependent bumps in the proposal. A placeholder
   package should only be released intentionally.
4. **Wait for the user's agreement before editing versions or changelogs.** Incorporate
   their requested versions or note changes. If investigation adds another package or
   changes the proposed release scope, show the revised proposal before applying it.

## Prepare the approved PR

1. Make sure the previous release workflow has completed successfully. Use a branch named
   `release/YYYY-MM-DD-N`, with the current date and the next unused positive number for
   that date; check remote branches and existing PRs too. For example,
   `release/2026-11-17-1`. Refresh from `origin/main` before preparing the release.
2. Update only the approved public package versions. Prepend a section headed exactly
   `## <version>` to each package's `CHANGELOG.md`, retaining older sections. Use the
   agreed user-facing notes, including migration guidance for breaking changes.
3. Preserve the repository's workspace peer/development dependency conventions. Regenerate
   the root lockfile with `pnpm install --lockfile-only`, and inspect the diff for unrelated
   dependency changes. Examples are updated separately after npm publication.
4. Run `pnpm check` and `pnpm examples:copy-check`. These run the repository's automated
   formatting, lint, types, tests, docs, builds, and standalone example checks.
5. Commit the approved changes, then run:

   ```sh
   pnpm release:plan origin/main HEAD
   pnpm release:pack origin/main HEAD
   ```

   The first command lists the exact release selection and validates versions and notes.
   The second creates npm archives locally using pnpm, runs strict publint on them, checks their public exports and
   required files, and checks that Katakit dependencies can be satisfied. It does not
   publish. Inspect any affected runtime assets and run relevant installed-package smoke
   checks too; manifest validation alone does not prove runtime behavior.

6. Open a PR titled `Release YYYY-MM-DD-N`, matching the branch suffix. Include the approved
   changelogs, old/new versions, checks and outcomes, and any manual checks not performed.
   Keep reviewer selection to the company's normal process.
7. If main changes before merge, refresh the branch, regenerate the plan, and rerun affected
   checks. Merge only one release PR at a time and wait for its release workflow to succeed
   before merging the next. CI publishes the exact merge snapshot; do not publish or tag
   from the local checkout.

## Follow through

Watch `Release npm packages` for the merged SHA. Verify each selected npm version, its
package-specific tag pointing to that SHA, and its GitHub release. If a step fails, follow
the rerun instructions in `.github/RELEASING.md`. Once all versions are available on npm,
use the separate `update-examples` skill for the follow-up PR.
