# Shared gallery presentation

These modules run in the local gallery and can be consumed by another website from a pinned
source checkout. They do not own application bootstraps, routing, or private services.

- `galleryDemoDetails.ts` owns React demo eligibility and metadata; `galleryDemos.tsx` adds lazy
  components. Keep extension information pages out of both. `#gallery-react-catalogue`
- Keep metadata and `Gallery.tsx` free of eager recognizer/runtime imports. Welcome loads lazily. Accept host-rendered links
  and children instead of importing a host router. `#gallery-portable-presentation`
- Scope portable gallery CSS beneath `.katakit-gallery`; the shared tooltip's own `.gallery-tooltip`
  root also scopes its header presentation outside that grid. Import only `internal/site-ui/components.css`.
  Own inner typography, spacing, and control rules here so host marketing CSS and demo-local button
  defaults cannot change the composition. The host supplies font/palette tokens. The local host opts
  into `theme.css`, the website-aligned Cobalt skin, with locally served licensed fonts; other hosts
  may use their own tokens. Never import a global reset from portable gallery modules. `#gallery-scoped-styles`
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
- Public mode is the default. `GalleryModeProvider` enables developer tools only when a host explicitly
  opts in through build configuration. Public mode and public preview ignore saved developer keys;
  never enable BYOK through a visitor URL or local-storage flag. `#gallery-developer-mode`
- `developerMode` describes the host build's capability. `GalleryModeProvider` owns `isPublicPreview`
  and derives `isDeveloperView` for every UI/connection decision. Keep environment checks in the
  host; do not create independent mode flags in gallery components. `#gallery-mode-state`
- Keep `GallerySpeechProvider` and `GalleryModeProvider` above the host header/outlet. The header’s
  `GalleryPreviewToggle` remains visible in developer builds while previewing public mode; it never
  renders in a public build. Mode transitions invalidate inference immediately, preserve saved
  developer settings/local content, and require explicit Start notes to resume. `#gallery-public-preview`
- Both modes use `GallerySpeechControls` for shared readiness, passive microphone, account, and usage
  controls. Settings opens the account/allowance page in public mode and Operation Setup with
  Configuration/Grid route tabs in developer mode. Host navigation comes through `onOpenSettings`;
  developer-only inference recovery still uses `onConfigureOperation`.
  `GalleryFooter` measures the footer for mobile spacing; keep these controls outside demo navigation. `#gallery-shared-controls`
- Plain hover text uses `GalleryTooltip` (custom triggers) or its `GalleryTooltipButton` adapter.
  Keep hover/focus/tap/dismissal behavior there. `galleryTooltip.css` owns shared panel/caret styling
  for those tooltips and interactive privacy/account popovers; use side/alignment options and local
  sizing variables instead of copying that CSS. Popovers retain their own interaction/focus rules. `#gallery-hover-panels`
- Developer pages use the current catalogue/capability metadata. Operation Setup configures local
  transcription and inference; key and model are visible together, endpoint overrides under Advanced.
  Configured indicates a selection, not a successful model/provider check. Do not add simulated signup
  actions, unsupported operations, or disabled demo navigation. `#gallery-operation-pages`
- Testing/listening stays in Welcome or each demo using `GalleryCaptureControls`. Keep inference
  admission, verification, and errors inside the demo. Host-reported allowance lives in the shared footer;
  retain it across demo visits, clear it when the inference source is invalidated, and never invent missing usage.
  Account identity/actions come from the host; do not simulate authentication. Navigating to setup is ordinary route
  exit: stop/drain the outgoing demo; retain the loaded model and saved settings. `#gallery-runtime-handoff`
