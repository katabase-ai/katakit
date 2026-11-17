# Platform starters

Read [README.md](README.md) for the copyability contract, vendor-archive exception,
platform verification checklist, and current maturity of each starter.

- Each starter is an independent pnpm project outside the root workspace. Run its own
  commands from its directory and keep required configuration/assets/licenses inside it.
- Keep platform permissions, bootstraps, UI, and input ownership local. Use public
  packages for genuinely reusable capabilities; custom application plugins stay local.
- Example-owned application content must derive from an event log. The MCP App's current
  writable notes subject is a migration gap, not the recommended plugin pattern.
- Use local plain CSS and avoid consumer Tailwind setup or private component dependencies.
- Until registry publication, include every required Katakit archive and transitive
  override locally. Rebuild archives from an identified source revision; verify their
  contents rather than assuming a same-version archive matches source.
- Run `pnpm templates:check` and `pnpm templates:copy-check <directory-name>` from the
  repository root for changed starters. Preserve checks for ordering, cleanup, permissions,
  and platform failures. Run the documented manual target-platform check before calling
  a starter verified; copy/build tests alone do not establish that claim.
