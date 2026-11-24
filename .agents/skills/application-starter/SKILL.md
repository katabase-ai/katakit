---
name: application-starter
description: Create or revise a Katakit application starter and its guide/README, including client or server input wiring, copyability, screenshots, and platform verification. Use for new platform starters or standardizing existing starter documentation.
---

# Author an application starter

Work from the repository root. Read `AGENTS.md`, `CONTRIBUTING.md`, `DEVELOPMENT.md`,
`examples/AGENTS.md`, `examples/starters/AGENTS.md`, `examples/starters/README.md`, and
`docs/AGENTS.md`, plus any instructions within the chosen starter. The contributor
checklist is the engineering authority; this skill organizes the authoring workflow.

## Establish the interaction

1. Check the working tree, current main, and requested scope before changing branches
   or files. For an existing starter, inspect its code, README, guide, tests, and actual
   manifest rather than copying claims from another platform.
2. Describe what the application is, its input, where Katakit runs, and its observable
   result. Identify host/process boundaries, required services, permissions, downloads,
   credentials, and data retention. Distinguish implemented behavior from proposed work.
3. Select the smallest real platform-input-to-Katakit interaction. Speech is appropriate
   for existing transcription starters, not a requirement for every future platform.
   Prefer an account-free local path; document unavoidable provider/account/cost needs.

## Implement or inspect the starter

1. Keep each starter independently installable under `examples/starters/<name>/` using
   registry dependencies and local assets/configuration. Follow the copyability checklist;
   do not add starters to the root workspace or import internal/sibling source.
2. Assemble public Katakit APIs locally. Application content comes from event-log events
   and projections. State source/segment/event identity rules where relevant. Replay must
   not call services, restart capture, generate replacement IDs, or reacquire resources.
3. Name the owners of subscriptions, capture, requests, sessions, cancellation, timers,
   and shutdown. For servers, document admission, credential injection, service boundaries,
   and request/session lifetimes. Do not promise a core stop/dispose API that does not exist.
4. Add focused deterministic behavior checks for real risks: ordering, duplicate delivery,
   cleanup, permissions, errors, or replay. Keep live-platform checks separate. For docs-only
   work, verify claims against implementation without expanding into runtime refactors.

## Write the reader-facing artifacts

- Start with [the guide template](templates/guide.md) and
  [the copied README template](templates/readme.md). Replace placeholders and remove
  unused optional content; a template is not evidence for a feature.
- The guide describes the existing app: summary, how it works, optional short
  status/limitations, Get started, Platform considerations, Make it yours, Additional resources.
  Keep that order. Give concrete file/API adaptation points and verify external links.
- The README owns exact commands, prerequisites, manual scenarios, tested versions,
  outcomes, skipped checks, and deployment instructions. Move useful verification facts
  there instead of discarding them with historical debugging prose.
- Include screenshots only when they explain something useful beyond the prose; omit
  empty/idle captures that add no information. Capture the actual application in an
  isolated profile or test vault. Never synthesize a screenshot or insert fake successful
  output into the DOM or use personal data. A screenshot does not establish live input
  or inference. Record date, version, source revision/dependency
  source, displayed state, and capture limits in the README. Store assets in
  `docs/public/starters/` and use `/starters/<name>.png` in authored guides.
- Keep existing page URLs. Search for links to headings before renaming/removing them;
  update repository references together. Add a navigation entry explicitly when needed;
  do not introduce empty client/server groups or restore WIP pages incidentally.

## Verify and report

1. Format changed Markdown/code and regenerate navigation if a page title or location changed.
2. Run docs checks, exporter tests, and `pnpm docs:export`. Inspect exported Markdown and
   assets and the rendered guide at desktop/mobile widths, including screenshot sizing.
3. Run `pnpm templates:check` and the affected `pnpm templates:copy-check <name>` checks
   for changed starters. For new/runtime/layout/dependency changes, follow all additional
   checks required by scoped instructions, including `pnpm check` where required. Verify
   published-package behavior against npm when relevant, not only local packed libraries.
4. Exercise the defined real platform interaction and a failure path before claiming it
   verified. If the environment blocks this, document the exact gap; a build, mock test,
   or screenshot is not a substitute. Stop every server/app/process started for verification.
5. Report commands/results, automated versus native/manual evidence, screenshot provenance,
   and remaining limitations. Do not mark experimental integrations complete just to finish
   the guide. Follow the user's instructions about commits, PRs, and merge approval.
