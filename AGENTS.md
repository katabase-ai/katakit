# Working in Katakit

Read [CONTRIBUTING.md](CONTRIBUTING.md) for durable engineering rules, the
[package layout](CONTRIBUTING.md#package-structure), and validation commands. Read the nearest
scoped `AGENTS.md` before editing. Use Node.js 24+ and pnpm 11.9.0.

- Start with `git status`, current main, and the affected manifests/source/tests. Preserve unrelated
  edits and use an isolated worktree when other work is active. Do not reset another checkout.
- `pkgs/` is the publishable library boundary. `internal/packages/` owns private build tools;
  plain internal assets have no manifest. Demos are workspace apps; starters install independently.
  Choose the location from the contributor table before adding a new dependency or directory.
- Trace a change through public entry points and callers. Keep application UI and host permissions
  in examples. Stateful plugin state derives from event-log events; recognition utilities stay
  independent of a plugin runtime. Do not assume core has a generic disposal API.
- For layout/dependency changes, inspect workspace globs, test discovery, package exports,
  copy preparation, docs coverage, and pinned website consumers. Record concrete companion
  integration changes rather than silently changing an external source contract.
- Use focused controlled tests for behavior changes. Run `pnpm check` before submission and
  `pnpm docs:export` for public API/docs/exporter changes. For example dependencies, imports,
  shared assets, or copy tooling, run the appropriate standalone copy checks as well.
- Report commands and results at the actual PR head. Distinguish automated copy/build checks
  from manual microphone/model/platform verification; do not claim untested behavior.

[Docs guidance](docs/AGENTS.md), [library guidance](pkgs/AGENTS.md),
[internal guidance](internal/AGENTS.md), and [example guidance](examples/AGENTS.md) narrow these rules.
