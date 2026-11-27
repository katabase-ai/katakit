---
name: event-sourced-application
description: Design and implement a new event-sourced application, or migrate an existing non-event-sourced application to events and projections. Use for domain event modeling, state-authority changes, replay-safe effects, and session/resource boundaries in Katakit apps, demos, and plugins. Not for package upgrades or schema-only migrations of already event-sourced histories.
---

# Build or migrate an event-sourced application

Use the [design guide](../../../docs/pages/reference/event-sourcing.md) as the shared authority
for architectural principles and the [core reference](../../../docs/pages/reference/core.md)
for API behavior. This skill organizes the work; do not duplicate those contracts here.
The [migration walkthrough](../../../docs/pages/getting-started/migrate-to-event-sourcing.md)
starts from an application that was not event-sourced.

## Establish the task

1. Determine whether this is a new application or an existing feature being migrated. Identify
   the target directory, required behavior, platform, integration constraints, and saved data.
   Respect the user's requested scope; a design-only request does not authorize implementation.
2. In a Katakit checkout, read `AGENTS.md`, `CONTRIBUTING.md`, `DEVELOPMENT.md`, and the scoped
   instructions for changed files. Check the working tree and current main; preserve unrelated
   work. In an external app, follow its instructions and inspect installed package versions.
3. Inspect the public APIs available in that version. Do not assume current repository examples
   work against an older published release. Keep application code on public package entry points.
4. For a new platform starter, also use `application-starter` for packaging, host input wiring,
   copyability, and platform verification. It does not replace this domain-design work.

## Design from behavior

1. Write a behavior inventory in domain terms: user actions, external inputs, accepted outcomes,
   and required views. For an existing app, inspect behavior, tests, storage, and resource owners
   first, but do not treat its current state shape as a required event model.
2. Complete the [design brief](references/design-brief.md) before implementation. Select events
   and projections from the inventory, then compare the design with implementation constraints.
   Adapt frontend interfaces when needed to express the better model while preserving behavior.
   If a reused plugin already owns the required events, use its log and projections instead of
   introducing a second history merely to migrate a UI wrapper.
   Model events as TypeScript `KatakitEvent` types, reusing a plugin's exported types where
   applicable. Runtime schemas for external input or storage decoding are separate boundary
   concerns, not the event model; do not add a serialization format to an in-memory demo merely
   to demonstrate replay.
3. If the proposed events simply mirror setters or a catch-all state object, do a fresh design
   pass using the behavior inventory and constraints. This does not require a new session or
   delegation. Do not discard product requirements to obtain a cleaner-looking model.
4. Explain judgment calls: event granularity, provenance, snapshot-sized accepted results,
   and session-versus-clear behavior. Use evidence to settle what it can; ask only about real
   product tradeoffs such as whether existing user data may be discarded.

## Build a new application

1. Choose the smallest useful interaction. Define its initial content and opening events,
   including any random layout or identity that must survive replay.
2. Implement domain methods that validate and record accepted facts, and projections that derive
   content from the built-in event log. Give each content value one authority. Define immutable
   payloads, seeds, identity rules, and application validation at external boundaries.
3. Connect inputs and views to that model. Assign each input source, subscription, and session
   a lifetime. Keep recognition adapters independent of the plugin runtime.
4. Add external work only with an explicit live trigger, result validation, acceptance event,
   cancellation policy, and late-result guard. Record accepted output before deriving content.
5. Add storage only when the product needs it. Document whether history survives a restart.

## Migrate an existing application

1. Capture representative behavior scenarios and inventory all existing content writers, including
   component setters, subjects, callbacks, loaders, imports, and model responses. Separate
   reconstructable content from provisional input and resource state.
2. Choose a bounded feature and define its cutover. Map each old content read/write to its new
   projection/method, after the domain design is established. State ownership at boundaries with
   unmigrated features. Do not leave the old store and new log as competing authorities.
3. Resolve saved data explicitly: fresh start only when appropriate and authorized; otherwise a
   validated import/baseline or a durable conversion plan. Preserve known IDs and provenance;
   never invent historical actions from a snapshot. Make retries safe and verify converted data
   before deleting or replacing its source.
4. Implement the event model, projections, UI bindings, and live-work ownership. Remove obsolete
   writable content state and callback mutations in the migrated feature. Preserve behavior,
   not an accidental component-state shape. Transient resource state can remain mutable with
   an explicit owner.
5. Check external callbacks and session transitions for writes to retired state or runtimes.
   Define what drains, what flushes, what is cancelled, and what can still be accepted. Core has
   no general stop/dispose API; use only cleanup actually implemented by the owning components.

## Verify and report

1. Exercise live commands/inputs, capture their history, then reconstruct in a fresh instance.
   Compare domain content, stable IDs, and derived outputs. Read projections before starting
   effects where possible. Test restoration with the app's serialized format when it has storage.
2. Assert no replay-induced model calls, new IDs, random draws, timer restarts, resource
   acquisition, or replacement events. Test explicit live resumption separately from replay.
3. Use meaningful tests for the identified risks: empty/opening history, corrections, clears,
   invalid and duplicate input, pending work, late responses, and shutdown. Do not substitute
   tests that merely repeat the implementation or textual checks for architectural behavior.
4. Run affected contributor checks. For copyable demos/starters, follow scoped standalone-copy
   requirements; for lifecycle changes, check gallery navigation and independent instances.
   Distinguish synthetic input/model tests from actual platform interaction.
5. Update the application's README with its events, projections, session boundary, resource
   owners, saved-data policy, and verification evidence. Link the shared design guide instead
   of copying its general rules. For copied applications, links must work outside the checkout.
6. Report changed files, architectural decisions, commands and outcomes, and any unverified
   behavior. Do not claim a build proves replay, cleanup, model quality, or microphone behavior.

## Worked references

- [Bingo events](../../../examples/demos/bingo/src/bingo/events.ts),
  [projections](../../../examples/demos/bingo/src/bingo/plugin.ts), and
  [reconstruction checks](../../../examples/demos/bingo/tests/plugin.test.ts):
  recorded layout, distinct speech/manual facts, and derived winning lines.
- [Structured notes](../../../examples/demos/notes/src/notesPlugin.ts) and
  [behavior checks](../../../examples/demos/notes/tests/notesPlugin.test.ts): accepted
  model results, recorded cursor, clear within a session, cancellation, and live resumption.

These references establish particular patterns, not blanket approval to copy every hook or
lifecycle decision. Recheck the source and relevant tests in the version being used.
