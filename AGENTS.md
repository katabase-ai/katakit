# Working in Katakit

Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup and contributing, and
[DEVELOPMENT.md](DEVELOPMENT.md) for public imports and engineering checks, then
the `AGENTS.md` files in the directories you change. These rules apply to maintainers,
contributors, and agents. Keep changes within the requested scope; existing deviations
are migration work, not patterns to repeat.

The [package layout](DEVELOPMENT.md#package-structure) and
[example copy workflow](examples/README.md) describe the current structure. Use Node.js 24+
and pnpm 11.9.0. Check `git status` and current main before changing a branch; preserve
unrelated work.

## Ownership and architecture

- Keep the core framework-independent and small. Publish a package only for a genuinely
  reusable capability. Example-specific plugins, prompts, UI, and orchestration stay local.
- Official stateful plugins and example plugins derive replayable application content
  from core's built-in `EventLogPlugin`. Methods record events; projections derive content. Do not
  keep a second writable subject or mutable object as the authority for that content.
  Use the [event-sourced application skill](.agents/skills/event-sourced-application/SKILL.md)
  for new application design or migration from non-event-sourced state, and the
  [design guide](docs/pages/event-sourcing/designing.md) for shared architectural principles.
- Resource handles, cancellation, retry status, provisional input, and display timing may
  be transient. Explain their owner and lifetime. Replay must not call a model, generate
  replacement IDs, restart timers, or reacquire resources.
- Recognition and model adapters expose general callbacks outside the plugin runtime.
  The application owns event schemas, input sources, credentials, admission, and storage.
- Keep publishable libraries in `pkgs/`. Private build tools belong under
  `internal/pkgs/` and CSS-only assets under `internal/site-ui/`. Copyable demos and
  starters in `examples/` must not depend on internal tools. The gallery's composition
  exception must be materialized by the copy workflow.

## Maintenance

- Import public APIs through declared package entry points. Do not introduce source-path
  aliases or imports into another public package's implementation.
- Put public API descriptions in source JSDoc; guides belong in `docs/pages/`. Update
  package exports, docs coverage, examples, and affected links together when APIs change.
- Prefer the documented React-RxJS pattern for runtime observable subscriptions. Keep
  microphone ownership hooks separate from observable-binding utilities.
- Identify who stops, drains, cancels, unsubscribes, and releases every resource. The core
  currently has no general stop/dispose API; do not promise cleanup it does not perform.
- Run the focused behavior checks for changed code and the affected contributor checks.
  Verify copyability and published-package behavior outside the workspace where relevant.
  Report commands, outcomes, skipped checks, and limits of mocked or build-only evidence.
- Fix substantive review findings before repeating the affected pattern. Defer cosmetic
  cleanup explicitly rather than folding speculative extractions into unrelated changes.

For layout/dependency changes, inspect workspace globs, test discovery, package exports,
copy preparation, docs coverage, and pinned website consumers. Run `pnpm check` and
relevant standalone copy checks; report automated versus manual evidence separately.

[Docs guidance](docs/AGENTS.md), [library guidance](pkgs/AGENTS.md),
[internal guidance](internal/AGENTS.md), and [example guidance](examples/AGENTS.md)
narrow these rules.
