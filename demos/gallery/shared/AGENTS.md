# Shared gallery presentation

These modules run in the local gallery and can be consumed by another website from a pinned
source checkout. They do not own application bootstraps, routing, or private services.

- `galleryDemoDetails.ts` owns React demo eligibility and metadata; `galleryDemos.tsx` adds lazy
  components. Keep extension information pages out of both. `#gallery-react-catalogue`
- Keep metadata and `Gallery.tsx` free of recognizer/runtime imports. Accept host-rendered links
  and children instead of importing a host router. `#gallery-portable-presentation`
- Scope gallery CSS beneath `.katakit-gallery`; import only site-ui component styles, inherit
  host typography/colors, and never import the global site-ui reset into portable modules. `#gallery-scoped-styles`
- `createGallerySpeech` wraps the delivered microphone transcriber. Keep a single active sink
  through awaited stop/drain, then close its runtime before creating the next. Keep only the model
  across navigation. Hiding the tab stops capture; root teardown disposes it. `#gallery-input-lifecycle`
- Instantiate demos only from a granted lease. Each demo owns its transcript plugin, projections,
  and explicit subscriptions; Bingo deliberately uses no core effects and completes its state
  through its close method. Do not assume a generic core disposal API exists. `#gallery-runtime-cleanup`

- Hosts pass the shared input controls to Gallery’s input slot. Keep them outside demo views and
  navigation landmarks; only the demo body remounts. Desktop controls anchor to the sidebar bottom;
  mobile controls reserve their measured height and stay visible. `#gallery-shared-controls`
