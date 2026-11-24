# Copyable feature examples

Each feature-demo directory owns its application/plugin code, UI, styling, manifest,
configuration, assets, and run instructions. Root `gallery/` composes demos and has an explicit
copy workflow for those source inputs; follow its narrower instructions.

- A user must be able to run `pnpm examples:copy demos/<name> <destination>` and
  install/build/run that copy without this checkout. No sibling imports, private packages,
  escaping symlinks, workspace-only versions, or source aliases inside a feature demo.
- Use public Katakit APIs and registry dependencies.
- Follow the [gallery authoring contract](../../docs/pages/reference/gallery.md) for embedded
  components. Keep the common interface natural in the standalone entry point; gallery-only
  props, context wiring, and wrappers belong in gallery adapters, not the copied example.
- Keep demo-specific plugins local. Durable content derives from logged events; transient
  microphone, network, retry, and display state can remain local. Existing Bingo state
  subjects are migration debt, not a model for new plugins.
- Prefer small React/TypeScript modules and local plain CSS. Do not require Tailwind or
  a shared design-system package. Necessary components are fine; a two-file demo is a
  simplicity goal, not a hard file-count rule.
- Intentional copies remain real local files. Maintain canonical-copy checks for shared
  example material; do not solve duplication with a dependency outside the copied folder.
- Gallery-specific adapters belong in the gallery and may import examples. Update its
  copy inputs and dependency manifest when adding sources. Keep the reverse dependency
  out of feature examples. Hosts own admission, credentials, and service URLs.
- Verify a prepared copy with no existing node_modules, install, build, relevant
  tests, and the documented manual interaction. Distinguish synthetic tests from live
  microphone/model verification. Preserve explicit resource cleanup on navigation.
