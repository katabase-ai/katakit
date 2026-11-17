# Shared gallery presentation

These modules run in the local gallery and can be consumed by another website from a pinned
source checkout. They do not own application bootstraps, routing, or private services.

- `galleryDemoDetails.ts` owns React demo eligibility and metadata; `galleryDemos.tsx` adds lazy
  components. Keep extension information pages out of both. `#gallery-react-catalogue`
- Keep metadata and `Gallery.tsx` free of eager recognizer/runtime imports. Welcome loads lazily. Accept host-rendered links
  and children instead of importing a host router. `#gallery-portable-presentation`
- Scope gallery CSS beneath `.katakit-gallery`; import only `internal/site-ui/components.css`, inherit
  host typography/colors, and never import the global shared reset into portable modules. `#gallery-scoped-styles`
- `createGallerySpeech` wraps the delivered microphone transcriber. Keep a single active sink
  through awaited stop/drain, then close its runtime before creating the next. Keep only the model
  across navigation. Hiding the tab stops capture; root teardown disposes it. `#gallery-input-lifecycle`
- Instantiate demos only from a granted lease. Each demo owns its transcript plugin, projections,
  and explicit subscriptions; Bingo deliberately uses no core effects and completes its state
  through its close method. Do not assume a generic core disposal API exists. `#gallery-runtime-cleanup`

- `galleryModel.tsx` owns the host model contract for `remoteModel` demos. `Gallery` takes one
  `connectModel`; a demo's gallery adapter reads it through `useGalleryModel` and converts host
  errors to its example's own error class. Keep it free of any one demo's types, and keep
  host admission and private service URLs in the host. `galleryInference.ts` owns the optional
  visitor-key transport and local-storage policy; never include keys or endpoint URLs in diagnostics. `#gallery-model-connection`
- Hosts pass `GallerySpeechControls` to Gallery’s input slot. Only the compact download/status
  and inference-source rows belong there, outside navigation landmarks. Desktop setup anchors to the
  sidebar bottom; mobile setup reserves its measured height and stays visible. Put testing/listening
  in Welcome or the demo using `GalleryCaptureControls`. Keep inference admission, verification,
  allowance, and errors inside the demo. `GallerySpeechProvider` also mounts the root inference
  settings provider so source choices survive navigation. Source changes invalidate remote work;
  local capture and content continue, and only Start notes resumes inference. `#gallery-shared-controls`
