# Authoring documentation

`docs/pages/` contains the Markdown published by the documentation site. Most
guides, concepts, and reference pages are authored there. Generated API reference
pages are different: their committed sources live beside the package they
describe, and the rendered Markdown in `docs/pages/` is a build artifact.

## API reference pattern

Keep the public contract close to the code: package-root exports define the API,
and JSDoc on public declarations describes behavior, options, defaults, errors,
and lifecycle limits. Put page metadata and the human-authored introduction,
example, and related context in the package's `docs/reference.json` and
`docs/reference.md`. The generator compiles these sources into a page under
`docs/pages/reference/`. Do not edit or commit the generated page. This build
step is deterministic; it does not generate prose with a model.

Currently **only event log** uses this pattern. Its sources are
`pkgs/event-log/src/`, `pkgs/event-log/docs/reference.json`, and
`pkgs/event-log/docs/reference.md`; its generated page is
`docs/pages/reference/plugins/event-log.md`. Other reference pages remain
hand-authored until they are migrated. The generator currently targets event log
specifically, so applying the pattern to another package will require extending
it and adding that page to the generation workflow.

From the workspace root, run `pnpm --filter @katakit/docs reference:generate` to
inspect the generated page locally. `pnpm docs:dev`, `pnpm docs:build`, and
`pnpm docs:check` regenerate it before the site, navigation, and link checker
read `docs/pages/`; a clean checkout therefore needs no generated page.
Relative links in package-local authored context resolve from the **published**
page path, not from the package-local source file. `pnpm docs:check` validates
links in the compiled page and checks that the compiled API still covers the
public export and its inferred plugin members.

For a new or moved page, regenerate and commit `docs/src/nav.json` using
`pnpm --filter @katakit/docs exec node scripts/generate-nav.mjs`. The navigation
file is committed even when a reference page is not, so run reference generation
first when adding a generated page.
