# Gallery host

`src/` is the local TanStack Start app; `shared/` contains portable gallery modules.
Run commands from the Katakit root with `pnpm --filter @katakit/gallery`.

- Keep the host router registration and generated route tree inside this app. Consumers import
  shared modules directly, never `src/`. `#gallery-host-boundary`
- Mount `GallerySpeechProvider` above the outlet. Each view acquires a deferred runtime lease;
  release stops/drains the input before closing that runtime. Keep public host navigation client-side.
  `#gallery-input-lifecycle`
- `src/galleryEnvironment.ts` is the reference host’s build-only developer gate. Normal production
  builds are public; dev server or explicit `VITE_GALLERY_DEV_MODE=true` enables developer tooling.
  The hosted PR workflow sets that flag for gallery review builds only. `pnpm preview` serves the
  last built artifact; the header's Preview toggle switches its effective UI/connection policy.
  Operation routes redirect in public builds. Public preview hides those routes within a developer
  build, retaining only its header switch as the way back. `#gallery-build-mode`
- Generate `src/routeTree.gen.ts` with the Start router plugin; do not edit it by hand.
- `localInferenceProxy.ts` runs only as local Vite dev/preview middleware. Keep credentials out
  of browser modules, `VITE_` variables, generated assets, responses and diagnostics. The host's
  `src/localInference.ts` discovers nonsecret metadata and connects only in developer mode on
  loopback. Public mode and public preview must not use this developer credential. Retain origin,
  loopback, request-size and cancellation checks; do not turn this into a deployed open proxy.
