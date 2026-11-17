# Private presentation bridge

This package is private local-preview/gallery infrastructure, not a public design system.
It is awaiting relocation into `internal/` and separation of host-only React components
from CSS shared with portable consumers.

- Do not add it as a dependency of a copyable feature demo or starter.
- Shared styling primitives should be CSS. Keep host-only React presentation in the host;
  do not expand this bridge into a component library as a way to reuse example UI.
- Portable modules import component styles without a global reset and scope their CSS.
  Keep host typography/colors and source pinning under the consumer's control.
- Preserve intentional local CSS/component copies until a copying/checking mechanism
  replaces them without breaking isolated directory copies.
