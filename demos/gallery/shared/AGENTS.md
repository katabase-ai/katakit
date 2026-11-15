# Shared gallery presentation

These modules run in the local gallery and can be consumed by another website from a pinned
source checkout. They do not own application bootstraps, routing, or private services.

- `galleryDemoDetails.ts` owns React demo eligibility and metadata; `galleryDemos.ts` adds lazy
  components. Keep extension information pages out of both. `#gallery-react-catalogue`
- Keep metadata and `Gallery.tsx` free of recognizer/runtime imports. Accept host-rendered links
  and children instead of importing a host router. `#gallery-portable-presentation`
- Scope CSS beneath `.katakit-gallery`; inherit host typography/colors and never import a global
  reset into portable modules. `#gallery-scoped-styles`
- Shared capture ownership is pending the delivered transcription utility. Do not recreate
  microphone capture, recognizer workers, or model catalogues here. `#gallery-transcription-handoff`
