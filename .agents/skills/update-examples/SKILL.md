---
name: update-examples
description: After a Katakit npm release succeeds, update Katakit dependency versions in every demo and starter and verify standalone installs against npm in a follow-up PR.
---

# Update examples after publication

Paths below are relative to the repository root. Read `AGENTS.md`, `CONTRIBUTING.md`,
`examples/AGENTS.md`, and the scoped instructions and README for each affected example.

1. Identify the completed release and its exact package/version mapping from its PR and
   GitHub releases. Check that its release workflow succeeded and its package tags point
   to the release commit. Query each intended version explicitly:

   ```sh
   npm view @katakit/core@<version> version --registry https://registry.npmjs.org
   ```

   Use the actual released package names and versions. **Do not update example versions
   until all required versions are available on npm.** Do not substitute `latest`, local
   archives, or workspace overrides for this check.

2. Inspect Git status and current `origin/main`; preserve unrelated work. Create a follow-up
   branch such as `examples/release-YYYY-MM-DD-N`, using the originating release identifier.
3. Enumerate **every** `examples/demos/*/package.json` and
   `examples/starters/*/package.json`, including the gallery. Update references to the
   released Katakit packages in dependencies, devDependencies, optionalDependencies, and
   peerDependencies as applicable. Preserve each example's existing exact/range style.
   Keep unreleased package references at their existing published versions.
4. Review the release notes for required example API changes. Read the affected directory
   instructions before making those changes. Check version references in example READMEs
   and configuration as well. Do not bump the private example applications' own versions
   merely to update their Katakit dependencies.
5. Refresh the root workspace lockfile for demos with `pnpm install --lockfile-only`.
   Starters are independent projects: run their dependency commands in their own
   directories and update their tracked lockfiles if present. Do not add starters to the
   root workspace or introduce local dependency overrides.
6. Run `pnpm check` and `pnpm examples:copy-check`. Then verify **all** demos and starters
   against the live registry:

   ```sh
   pnpm demos:copy-check --registry
   pnpm templates:copy-check --registry
   ```

   These copy examples outside the workspace and install/build/test without substituting
   locally packed Katakit packages. Root workspace linking and the default local-package
   copy checks alone do not verify the npm release.

7. Run relevant manual platform checks when interactions changed. Distinguish automated
   install/build/test results from microphone, model, browser-extension, and native-platform
   evidence; report checks that could not be performed.
8. Open a separate PR, for example `Update examples for Release YYYY-MM-DD-N`, linking the
   release PR. Summarize the dependency updates, affected demos/starters, registry-backed
   results, and manual verification limits. Follow the company's normal review process.
