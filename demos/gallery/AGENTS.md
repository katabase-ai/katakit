# Gallery host

`src/` is the local TanStack Start app; `shared/` contains portable gallery modules.
Run commands from the Katakit root with `pnpm --filter @katakit/gallery`.

- Keep the host router registration and generated route tree inside this app. Consumers import
  shared modules directly, never `src/`. `#gallery-host-boundary`
- The existing demos still own independent legacy recognizers and module-level runtimes.
  Keep document navigation between them until PR #28 and verified runtime cleanup allow a shared
  input owner. Do not claim model retention or complete runtime teardown. `#gallery-input-handoff`
- Generate `src/routeTree.gen.ts` with the Start router plugin; do not edit it by hand.
