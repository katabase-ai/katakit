# Gallery host

`src/` is the local TanStack Start app; `shared/` contains portable gallery modules.
Run commands from the Katakit root with `pnpm --filter @katakit/gallery`.

- Keep the host router registration and generated route tree inside this app. Consumers import
  shared modules directly, never `src/`. `#gallery-host-boundary`
- Mount `GallerySpeechProvider` above the outlet. Each view acquires a deferred runtime lease;
  release stops/drains the input before closing that runtime. Keep public host navigation client-side.
  `#gallery-input-lifecycle`
- Generate `src/routeTree.gen.ts` with the Start router plugin; do not edit it by hand.
