# Publishable libraries

Follow [library standards](../CONTRIBUTING.md#add-or-change-a-library) and each package's
scoped instructions. All packages here are intended for publication under `@katakit/`;
private tools belong in `internal/pkgs/`.

- Export supported APIs through `package.json` entry points and generated declarations.
  Keep the development `source` condition out of published exports. Private tools must
  set `private: true` and must not become runtime dependencies of public packages.
- Stateful application content comes from an event log. Separate deterministic replay
  projections from resource ownership and transient control state. The event log itself
  necessarily owns its event source; a blanket ban on RxJS subjects is inappropriate.
- Keep schemas caller-owned and use Standard Schema at the event-validation boundary.
  Document synchronous-validation constraints and who validates restored history.
- Keep UI, microphone capture, and provider-specific runtime code out of core plugins.
  Put adapters behind explicit boundaries; do not add demo-specific behavior to core.
- For public API changes, update JSDoc, package documentation, exporter coverage, and
  installed-package checks. Test the packed artifact when exports or assets change;
  successful workspace imports do not establish that a package can be consumed.
- Test meaningful contracts: replay, ordering, failure/retry behavior, cancellation,
  ownership, and public typing. Use controlled inputs rather than timing sleeps.
- Runtime source cannot import examples, docs, internal assets, or private tool APIs.
  Check affected standalone copies and rebuild their archives when library source changes.
