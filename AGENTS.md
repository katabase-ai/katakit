# Working in Katakit

Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, public imports, and checks, then
the `AGENTS.md` files in the directories you change. These rules apply to maintainers,
contributors, and agents. Keep changes within the requested scope; existing deviations
are migration work, not patterns to repeat.

## Ownership and architecture

- Keep the core framework-independent and small. Publish a package only for a genuinely
  reusable capability. Example-specific plugins, prompts, UI, and orchestration stay local.
- Official stateful plugins and example plugins derive replayable application content
  from `@katakit/event-log`. Methods record events; projections derive content. Do not
  keep a second writable subject or mutable object as the authority for that content.
- Resource handles, cancellation, retry status, provisional input, and display timing may
  be transient. Explain their owner and lifetime. Replay must not call a model, generate
  replacement IDs, restart timers, or reacquire resources.
- Recognition and model adapters expose general callbacks outside the plugin runtime.
  The application owns event schemas, input sources, credentials, admission, and storage.
- Keep public libraries in `pkgs/` until the planned layout migration. Private build and
  presentation tools belong under `internal/`; do not add another private package to
  `pkgs/`. Copyable demos and starters must not depend on internal tools.

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

The dated audit and migration order are in
[maintenance/jude-guidance-audit.md](maintenance/jude-guidance-audit.md).
