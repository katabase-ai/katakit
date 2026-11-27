# Copyable feature examples

Each feature-demo directory owns its application/plugin code, UI, styling, manifest,
configuration, assets, and run instructions. These standards apply to every feature demo,
including existing examples. Follow the selected demo's README and local `AGENTS.md` for
its concrete setup and manual checks.

The copyability and ownership rules below are requirements. Words such as "prefer" and
"when ... improves discovery" describe choices, not mandatory folder names or file counts.
Use the smallest arrangement that makes the demo's owners and boundaries clear.

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
- Put the general copy workflow and repository-wide maintenance in
  [the examples guide](../README.md), not in a copied demo's introduction. A demo's local
  guide still gives its exact copy path, run commands, and verification steps.

## Code and styles

- Prefer a thin standalone entry such as `src/app.tsx` for mounting and composition; an
  existing `main.tsx` and `App.tsx` split is also fine. Keep feature behavior, views, and
  orchestration together in a domain folder when that improves discovery. Put host-neutral
  visual widgets with application-level inputs (for example, buttons or a general transcript
  column) in the demo's local `src/ui/`. Views coupled to feature types, rules, or results
  stay with the feature. A demo does not need `src/ui/` if it has no such widgets. Do not
  introduce a shared UI package or split a small example just to meet a file-count target.
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
- Use [Designing event-sourced applications](../../docs/pages/reference/event-sourcing.md)
  to choose events, projections, session boundaries, and replay-safe live work. For an existing
  mutable-state demo, follow [Migrate an existing application](../../docs/pages/getting-started/migrate-to-event-sourcing.md).
  Agents designing a new event-sourced demo or migrating one must use the
  [event-sourced application workflow](../../.agents/skills/event-sourced-application/SKILL.md).
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
- Run focused tests and `pnpm check`. Verify an independently installed copy using
  `pnpm demos:copy-check <name>`; this installs without an existing `node_modules`, builds,
  checks types and tests, and smoke-checks served assets and headers. `pnpm check` does not
  replace that copy check. Run `pnpm gallery:copy-check` when gallery consumption changes.
  Copy checks do not start a live microphone or model. Check the demo's documented browser
  interactions when possible, including cleanup on navigation, and report those observations
  separately from automated results; say explicitly when a live check was not run.
