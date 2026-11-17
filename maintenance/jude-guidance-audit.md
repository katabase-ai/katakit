# Katakit architecture audit and maintenance plan

Audited November 17, 2026 against `origin/main` at
`5efcb3134f1b014e15978ac7fb02e31e9400241e`. The original checkout was on
`codex/cloudflare-previews`, eleven commits behind main and one commit ahead.
This audit and standards documentation were prepared in an isolated worktree on
`codex/jude-guidance-audit`; no runtime migrations are included.

## Assessment

The repo has implemented much of Jude's intended separation: reusable recognition utilities,
demo-local plugins, replayable structured notes, documentation export, independent platform
starters, and a useful root README. The largest gaps are inconsistent event sourcing and
unverified demo distribution outside the workspace. Existing CI is substantial and passes,
but does not establish compliance with those architecture requirements.

Statuses below describe code at the audited revision, before this documentation change.
An implemented boundary does not imply every possible runtime/platform has been verified.

## Source guidance

- **S1:** [November 15: Website and gallery architecture with Jude](https://notes.granola.ai/d/3033c973-bdb0-478d-870d-9c9bbf6b8925).
  Generic adapters 1:40–10:35; React/validation 11:33–19:42; docs 24:24–28:40;
  final website boundary 58:43–66:48; portable examples and local plugins 67:12–85:16;
  DevTools 87:15–102:16; review triage 103:00–104:41; small core 105:48–106:08.
- **S2:** [November 16 morning: Dev kit architecture](https://notes.granola.ai/d/2222010d-2dc0-4d7d-893d-652e37bf054e).
  Lifecycle update 16:35; README 18:46–24:30 and 42:45–43:10; examples layout
  35:19–38:25; ingestion 41:56–54:35; runtime/provider packaging 59:18–62:38;
  internal tooling/CSS/copying 63:09–65:29; agent standards 65:32–67:24;
  OpenTelemetry deferral 68:49–69:29.
- **S3:** [November 16 midday: Landing page and demo architecture](https://notes.granola.ai/d/ec78652b-e6f9-4434-9a91-7cc28649a03d).
  Minimal examples, npm dependencies, CSS 36:38–38:25; Markdown 55:42–57:00;
  event-derived plugin content 57:02–58:11; publishing 64:10–65:22.

These are paraphrased meeting requirements, not a claim that every suggestion was a final
decision. The flat examples directory was suggested then superseded by the agreed nested
layout; symlinks were considered then questioned; provider splitting and DevTools
extensibility were explicitly deferred. The later Drew-only call is not evidence of a new
direct instruction from Jude. No private Protozoa implementation or open-PR diff was audited.

## Requirement coverage

| Guidance                                                                | Status                                                    | Evidence and remaining work                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Small core; generic public capabilities only (S1)                       | Mostly implemented                                        | [Core](../pkgs/core/src/index.ts) is runtime/reactive infrastructure. Bingo and notes plugins are local to examples. `@katakit/react` is still an empty public-package placeholder; decide its release treatment rather than expanding it speculatively.                                                                                                                                                                                                                             |
| Public versus private packages (S2)                                     | Partial                                                   | [docs-export](../pkgs/docs-export/package.json) and [site-ui](../pkgs/site-ui/package.json) correctly have `private: true`, but remain in `pkgs/`. Move to `internal/packages/` and update workspace/export/check paths.                                                                                                                                                                                                                                                             |
| `examples/demos/` and `examples/starters/` (S2)                         | Missing                                                   | Current names are `demos/` and `templates/` in [workspace configuration](../pnpm-workspace.yaml). Gallery infrastructure is also a child of demos. Layout migration must preserve the independent starter workspace policy.                                                                                                                                                                                                                                                          |
| Independently copyable examples (S1, S3)                                | Partial; demo install failure reproduced                  | Feature demos own local source and ordinary versioned dependencies, but depend on unpublished `@katakit/*@0.0.0`. A fresh copy of notes fails installation with a registry 404. Starters solve this temporarily through local vendor archives and overrides.                                                                                                                                                                                                                         |
| Demo-local code and intentional duplication (S1)                        | Implemented, with maintenance gaps                        | Bingo is local in both [browser](../demos/bingo-react/src/bingo/plugin.ts) and extension examples. [Copy equality](../scripts/check-bingo-copy.mjs) runs in lint. Local CSS/controls are copied too, without the same general regeneration/provenance mechanism. No new shared public package is needed.                                                                                                                                                                             |
| Plain CSS and no example design-system dependency (S1–S3)               | Mostly implemented                                        | Feature demos and starters own CSS without a Tailwind setup. [site-ui](../pkgs/site-ui/src/index.tsx) still exports React components, including controls imported by [portable gallery modules](../demos/gallery/shared/GallerySpeechControls.tsx). Separate host-only React presentation from the shared CSS contract; do not remove necessary local React components from examples.                                                                                                |
| Replayable plugin content from event log (S2, S3)                       | Partial; important gap                                    | [Notes](../demos/notes-react/src/notesPlugin.ts#L50) derives content/Markdown from logged turns, accepted results, and clears. [Ingestion](../pkgs/transcript-ingestion/src/plugin.ts#L47) projects a private Subject and optionally forwards elsewhere; [Bingo](../demos/bingo-react/src/bingo/plugin.ts#L123) and [MCP notes](../templates/mcp-app/src/notes.ts#L7) mutate subject-owned content. These are not equivalent to replay from `@katakit/event-log`.                    |
| Generic recognition adapters outside runtime (S1, S2)                   | Implemented                                               | [Transcription callbacks](../pkgs/transcription/src/types.ts) and [base transcriber](../pkgs/transcription/src/index.ts) have no plugin dependency. Ingestion accepts text/source/speaker metadata, handles source switches, and does not own audio. Method names differ from the meeting's illustrative names, which is not itself a defect.                                                                                                                                        |
| Runtime/provider distribution split (S2)                                | Partly addressed; deferred                                | Transcription has provider/browser/assets/Vite/React subpaths and optional peers. Its build still copies both provider runtimes into one distribution. Subpaths are not independently installable packages. Validate download costs and Node/offline requirements before choosing a split; no wake-word utility is present.                                                                                                                                                          |
| Existing React-RxJS bindings (S1)                                       | Partial                                                   | [React guide](../docs/pages/getting-started/react.md) and earlier examples use React-RxJS; current [notes](../demos/notes-react/src/NotesDemo.tsx), [transcription](../demos/transcription-react/src/TranscriptionDemo.tsx), and [browser Bingo](../demos/bingo-react/src/BrowserBingoDemo.tsx) manually bridge observables into React state. This is pattern drift, not evidence of a current rendering bug. The optional microphone hook owns resources and is a separate concern. |
| Validator independence (S1)                                             | Implemented                                               | [Event log](../pkgs/event-log/src/plugin.ts) accepts Standard Schema and rejects async validation. Valibot in an application/schema example is allowed. Initial history is trusted by the event log; caller validation is documented in notes.                                                                                                                                                                                                                                       |
| JSDoc reference, Markdown guides, versioned portable docs (S1)          | Implemented structurally                                  | [Exporter contract](../docs/EXPORT.md), explicit package/subpath coverage, provenance, link checks, and local viewer are present. A real export generated 100 pages. Some instructional examples still teach subject-owned plugin content; revise those with the state migration. Export success does not establish prose quality or historical-version publication on the private site.                                                                                             |
| DevTools in React package; internal components; dev-only rendering (S1) | Not implemented                                           | [React entry point](../pkgs/react/src/index.ts) exports nothing. No DevTools implementation was found in tracked source. Choose a minimal debug surface or explicitly defer it; do not claim dev-only rendering/CSS isolation are already available.                                                                                                                                                                                                                                 |
| Private website versus public source boundary (S1, S2)                  | Implemented on the Katakit side; external side unverified | Docs export and [gallery shared modules](../demos/gallery/shared/AGENTS.md) provide consuming-host contracts. Model credentials/admission/service transport remain host-supplied. A local preview host in this repo is intentional, not evidence the private production website was moved here.                                                                                                                                                                                      |
| Familiar README and package/plugin list (S2)                            | Mostly implemented                                        | [README](../README.md) now has introduction, motivation, a small example, docs links, package/plugin catalog, and clear unpublished/WIP disclosure. Badges/logo/community link are lower-priority presentation work; no need to create Discord or publish telemetry as part of architecture cleanup.                                                                                                                                                                                 |
| Scoped agent standards and meaningful checks (S1, S2)                   | Partial before this change                                | Six leaf guidance files, [CONTRIBUTING](../CONTRIBUTING.md), lint/types/tests/docs/build CI, template-copy CI, and Bingo copy checks existed. No root, package-wide, demo-wide, or starter-wide AGENTS files existed. Import/layout/event-sourcing policies were not enforced by architecture checks. This change documents standards; enforcement remains planned.                                                                                                                  |

## Prioritized implementation sequence

Priorities are proposed execution order, not incident severity. Each item should be a reviewable
PR with its own acceptance checks. Avoid mixing filesystem moves with state-machine changes.

### P0 — Establish standards and make the copy/run promise true

1. **Land the scoped standards documentation in this change.** Root guidance defines
   ownership and invariants; narrower files cover public packages, ingestion, transcription,
   React/DevTools, demos, starters, and the private UI bridge. Preserve the existing leaf
   guidance for notes, gallery, docs, exporter, and persistence. Link these from CONTRIBUTING.
   These rules apply to new/touched work; unrelated existing gaps do not require opportunistic
   rewrites. Acceptance: instructions are discoverable, noncontradictory, and distinguish
   durable content from transient control state.
2. **Make every advertised feature demo install from a clean directory copy.** Prefer a
   coordinated initial public package release when ready. Until then, extend the starter
   vendor-archive approach to demos, including the notes demo's event-log dependency and
   all transitive overrides. Preserve public npm dependencies. Replace ad hoc packing steps
   with a documented script and source-revision/content provenance. A same-version `0.0.0`
   archive must not be assumed current. Do not publish from this audit task.
   Acceptance: all four feature demos and five starters copy without escaping links, install,
   build, and run their deterministic tests outside the checkout with no workspace aliases.
   Include nested-base worker/WASM checks for browser consumers. Put feature-demo copies
   into CI alongside starter copies; retain separate manual platform/audio evidence.

### P1 — Make the advertised state model consistent

3. **Migrate transcript ingestion to canonical logged finalized events.** Agree on the
   caller-schema/event mapping contract first. Derive finalized turns/reset behavior from
   the supplied event log; keep provisional text and live silence/resource state transient.
   Keep the recognition utility independent. Audit all consumers and copied starter archives.
   Acceptance: replay reconstructs finalized transcript/turns, source/speaker boundaries and
   retransmission IDs remain correct, and replay does not restart timers or duplicate events.
4. **Migrate Bingo, MCP notes, and teaching examples.** Record accepted board contents,
   manual overrides, finalized transcript inputs, and note additions as events. Preserve IDs
   and chosen square contents so replay does not rerandomize a board. Keep these plugins
   local; update the canonical Bingo copy and its checked extension copy together. Rewrite
   the React guide's subject-backed Counter as an event-derived example.
   Acceptance: equivalent history restores equivalent content without network work or fresh
   randomness; manual operations append events; transient UI controls are not unnecessarily
   logged. Test fresh runtime/hydration, reset/clear, and resource shutdown.
5. **Add focused architecture checks and regression coverage.** Enforce public entry-point
   imports, private-package exclusion, per-example dependency/alias/symlink boundaries,
   independent manifests, and no consumer Tailwind setup. Use resolved imports/manifests,
   including dynamic imports and CSS imports, rather than a blanket text ban. Allow the
   gallery's one-way imports of feature examples and explicitly scoped test fixtures.
   Stateful behavior is verified by replay tests and review, not a repository-wide ban on
   `Subject`/`BehaviorSubject`; notes correctly uses Subjects for retry/cancellation.
   Acceptance: checks reject representative invalid boundaries, allow intended contracts,
   and run in CI. Include `test:package` and `test:runtime` in the appropriate CI job;
   those transcription checks currently exist but are not explicitly invoked by the workflow.

### P2 — Consolidate layout and recommended integration

6. **Move directories in a mechanical PR.** Target layout:

   ```text
   AGENTS.md
   CONTRIBUTING.md
   pkgs/                         # public libraries and package standards
   internal/packages/docs-export/
   internal/packages/site-ui/    # CSS; host React presentation separated
   internal/gallery/            # local host + portable gallery adapters
   examples/AGENTS.md           # common copyability/event/style standards
   examples/demos/
   examples/starters/           # still independent pnpm projects
   docs/                        # authored docs and local viewer
   maintenance/                 # contributor-only audit/decision records
   ```

   Jude explicitly requested internal package and examples separation. Moving the gallery
   host to `internal/gallery/` is this audit's recommendation to keep it outside the copyable
   demo inventory. Update workspace globs, recursive Vitest projects, scripts, package
   repository metadata, exporter config, docs links/navigation, previews, source pins, and
   any consuming private-site paths in coordination. Move each scoped AGENTS file with its
   domain and share example rules at `examples/AGENTS.md`. Acceptance: old paths are gone
   from active configs/links, all workspace and copy checks pass, and the consuming site
   verifies a new exact pin. Do not make starters root-workspace members just for symmetry.

7. **Resolve styling and subscription drift.** Split private host-only React controls from
   shared CSS, move them to the local/private host, and keep example-local copies simple.
   Add a narrow copy/sync check where intentional duplicate styling needs maintenance.
   Adopt React-RxJS consistently in example views while preserving per-visit resource
   ownership, initial values, Strict Mode behavior, and navigation teardown. Do not extract
   another observable-hook package. Acceptance: isolated copies still work; host resets do
   not leak into portable modules; subscriptions release on unmount; no extra writable
   authoritative content state appears.

### P3 — Explicit follow-up decisions

8. **Scope DevTools and lifecycle work separately.** Decide whether the first release needs
   a minimal event inspection/replay panel. If yes, implement in `@katakit/react` with
   internal components, compiled CSS, and development-only rendering by default. Verify
   production exclusion in a consumer. Otherwise document the deferral and decide whether
   to exclude the empty placeholder from publication. A shadcn registry/extensibility API
   is not prerequisite. Core has no general stop/dispose API and persistence `kill()` does
   not unsubscribe or propagate a failed final save; keep those limitations explicit and
   address them in a separate lifecycle proposal rather than inventing APIs in examples.
9. **Measure provider/runtime packaging before splitting it.** Separate browser versus
   Node/offline requirements, provider runtime assets versus model weights, download costs,
   optional peers, licenses/notices, and model caching. Subpath exports are useful progress.
   Require independent-install/headless and browser runtime fixtures for any package split.
   Wake-word/diarization utilities, OpenTelemetry, advanced DevTools distribution, badges,
   and community setup remain follow-up scope rather than blockers for the earlier fixes.

## Verification performed

- Clean dependency install from the pinned lockfile, with lifecycle install scripts disabled.
- Unmodified-main `pnpm check`: passed, including formatting, lint, licenses, template
  manifests, workspace typechecking, **45 test files / 256 tests passed, 18 tests skipped**,
  docs checks, exporter tests, and library/demo/viewer builds. Skipped tests are not proof
  those behaviors work. The build emitted a docs chunk-size advisory.
- `pnpm docs:export`: passed; generated 100 pages from the audited source revision.
- `pnpm -F @katakit/transcription test:package`: passed; a real packed package executes
  and typechecks without React, RxJS, provider SDKs, source aliases, or base DOM types.
- `pnpm -F @katakit/transcription test:runtime`: passed; verified 33 runtime assets,
  development headers/MIME types, and production copying under a nested base URL.
- `pnpm templates:copy-check react-web`: passed install, production build, and the copied
  starter's deterministic test outside the workspace using its vendored packages.
- Fresh directory copy of `demos/notes-react`, excluding dependencies/build output/local
  environment files, followed by `pnpm install`: failed with
  `ERR_PNPM_FETCH_404` for `@katakit/transcript-ingestion` from the public npm registry.
  This demonstrates the distribution gap even though the workspace build passes.
- No live recognition/provider-quality checks, manual Electron/Obsidian/extension checks,
  production website integration, registry publication, or open-PR completion audit was
  performed. The full five-starter copy matrix is defined in CI but was not rerun locally.
- Documentation changes: checked all 47 local Markdown links in the changed/new documents;
  no missing targets. Formatting and whitespace checks passed.

## Standards files added

| Scope             | File                                                                          | Purpose                                                                      |
| ----------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Repository        | [AGENTS.md](../AGENTS.md)                                                     | Ownership, replayable versus transient state, docs, review and verification  |
| Public libraries  | [pkgs/AGENTS.md](../pkgs/AGENTS.md)                                           | Public exports, schemas, package boundaries and installed-consumer contracts |
| Ingestion         | [pkgs/transcript-ingestion/AGENTS.md](../pkgs/transcript-ingestion/AGENTS.md) | Source-neutral input, log migration and live/replay semantics                |
| Recognition       | [pkgs/transcription/AGENTS.md](../pkgs/transcription/AGENTS.md)               | Adapters, runtime resources, optional integrations and packed assets         |
| React/DevTools    | [pkgs/react/AGENTS.md](../pkgs/react/AGENTS.md)                               | Placeholder status and bounded future DevTools contract                      |
| Feature examples  | [demos/AGENTS.md](../demos/AGENTS.md)                                         | Directory copyability, local plugins/CSS and host isolation                  |
| Platform starters | [templates/AGENTS.md](../templates/AGENTS.md)                                 | Independent projects, archive provenance and platform verification           |
| Private UI bridge | [pkgs/site-ui/AGENTS.md](../pkgs/site-ui/AGENTS.md)                           | CSS/host ownership and no public design-system expansion                     |

Keep short actionable invariants in these files, setup/commands in CONTRIBUTING and scoped
READMEs, and dated findings in this report. Update the report's statuses after migrations;
do not make future agents infer implemented behavior from an intended standard.
