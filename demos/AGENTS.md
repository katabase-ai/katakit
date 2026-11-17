# Copyable feature examples

Each feature-demo directory owns its application/plugin code, UI, styling, manifest,
configuration, assets, and run instructions. `gallery/` is host infrastructure, not a
copyable feature demo; follow its narrower instructions.

- A user must be able to copy one demo directory and install/build/run it without files
  elsewhere in this checkout. No sibling imports, private packages, escaping symlinks,
  workspace-only versions, or source aliases inside a feature demo.
- Published Katakit APIs and ordinary public npm dependencies are allowed. Before a
  registry release, an example needs self-contained vendor archives and transitive
  overrides or another explicitly verified distribution path. A `0.0.0` dependency
  resolved by workspace linking is not proof of standalone installation.
- Keep demo-specific plugins local. Durable content derives from logged events; transient
  microphone, network, retry, and display state can remain local. Existing Bingo state
  subjects are migration debt, not a model for new plugins.
- Prefer small React/TypeScript modules and local plain CSS. Do not require Tailwind or
  a shared design-system package. Necessary components are fine; a two-file demo is a
  simplicity goal, not a hard file-count rule.
- Intentional copies remain real local files. Maintain canonical-copy checks for shared
  example material; do not solve duplication with a dependency outside the copied folder.
- Gallery-specific adapters belong in the gallery and may import examples. Keep the
  reverse dependency out of examples. Hosts own admission, credentials, and service URLs.
- Verify a fresh directory copy with no existing node_modules, install, build, relevant
  tests, and the documented manual interaction. Distinguish synthetic tests from live
  microphone/model verification. Preserve explicit resource cleanup on navigation.
