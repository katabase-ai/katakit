# Copyable feature examples

Each feature-demo directory owns its application/plugin code, UI, styling, manifest,
configuration, assets, and run instructions. These are conventions for new or revised demos,
not a mandate to reorganize every existing example. Follow the selected demo's README and
local `AGENTS.md` for its concrete setup and manual checks.

## Copyability and boundaries

- A user must be able to run `pnpm examples:copy demos/<name> <destination>` and
  install/build/run that copy without this checkout. No sibling imports, private packages,
  escaping symlinks, workspace-only versions, or source aliases inside a feature demo.
- Use public Katakit APIs and registry dependencies.
- Intentional copies remain real local files. Maintain canonical-copy checks for shared
  example material; do not solve duplication with a dependency outside the copied folder.

## Documentation

- Keep the demo README short: what it does, what it demonstrates, and a link to its local
  `AGENTS.md`. Put install/run steps, model and input requirements, organization,
  customization, hosting, and manual verification in that local guide. Cross-link them.
- Put repository-wide copy commands and maintenance in [the examples guide](../README.md),
  not in a copied demo's introduction. Keep demo-specific instructions with the demo.

## Code and styles

- Prefer a thin `src/app.tsx` for standalone mounting and composition. Keep feature behavior,
  views, and orchestration beside one another in a domain folder when that improves discovery;
  put generic visual primitives in the demo's local `src/ui/`. Do not introduce a shared UI
  package or split a small example just to meet a file-count target.
- Put behavior tests in `tests/` and cover meaningful boundaries, including resource cleanup
  where relevant. Add presentation tests when rendering behavior warrants them; avoid tests
  that merely restate the file layout.
- Keep standalone theme defaults and global resets imported only by the standalone entry.
  Put generic widget styles with `ui/` and feature-specific styles with the feature. A tiny
  edge case does not need its own stylesheet. Prefer local plain CSS; do not require Tailwind.

## State and resource ownership

- Keep demo-specific plugins local. Derive durable application content from logged events;
  transient microphone handles, retry status, provisional input, and display timing may stay
  local. Replay must not rerun input or generate replacement content. See the
  [repository event-sourcing rules](../../AGENTS.md#ownership-and-architecture).
- Make the owner and lifetime of microphones, model instances, subscriptions, timers, and
  runtimes explicit. Stop, drain, unsubscribe, or close them at the appropriate boundary;
  do not assume core provides a general runtime disposal API.

## Gallery integration and verification

- Follow the [gallery authoring contract](../../docs/pages/contributing/gallery.md) for embedded
  components. Give reusable views natural application-level inputs. Gallery-only props,
  context wiring, and wrappers belong in gallery adapters, not the copied example.
- Gallery-specific adapters belong in the gallery and may import examples. Update its
  copy inputs and dependency manifest when adding sources. Keep the reverse dependency
  out of feature examples. The gallery has an explicit copy workflow for those inputs;
  follow its narrower instructions. Hosts own admission, credentials, and service URLs.
- Run focused tests and `pnpm check`; verify a prepared copy with no existing
  `node_modules` using `pnpm demos:copy-check <name>`. Run `pnpm gallery:copy-check`
  when gallery consumption changes. Check the documented interaction manually when
  possible, including resource cleanup on navigation. Distinguish synthetic/build
  evidence from live microphone, model, and platform verification in the report.
