# Demo gallery

## Prepare an independent copy

From an installed Katakit checkout, run:

```sh
pnpm examples:copy demos/gallery /tmp/my-gallery
cd /tmp/my-gallery
pnpm install
pnpm build
pnpm preview
```

The gallery copy includes demo sources under `sources/` and shared CSS under `styles/`.

This is the local TanStack Start host for the React demo gallery. It runs without the private
website, account credentials, or a model-provider key. Install dependencies from the Katakit root:

```sh
pnpm install --frozen-lockfile
pnpm build:pkgs
pnpm -F @katakit/gallery dev
```

Open <http://127.0.0.1:4347>. Welcome is `/`; React demos are at `/demos/transcription`,
`/demos/bingo`, `/demos/notes`, `/demos/color-clash`, and `/demos/brainstorm`. Color Clash uses local transcription
and its Play button starts capture and a timed round; it needs no inference connection. Notes
transcription runs locally; generating notes requires
a host-supplied model connection. Developer mode can instead use your own OpenRouter key. Extension setup pages are outside this catalogue. Direct links and unknown-demo
responses are handled by Start. Browser-only demo modules mount after hydration, not during SSR.

`shared/ColorClashGalleryDemo.tsx` adapts the existing game to the shared speech owner and runtime
lease. The game directory is unchanged. Navigation stops/drains capture and releases the game,
while the loaded speech model remains ready for the next demo. Named `colorClashGalleryDemo`
is available from `shared/galleryDemos.tsx`; embedding hosts with an explicit selection must add
that entry when adopting this source revision. This does not remove the website's homepage embed.

The [brainstorming game](../brainstorm-react/README.md) uses the shared microphone with a sticky
note board, 200 challenges, and 30s, 1min (default), 2min, or unlimited rounds.
Challenges stay hidden and the clock stays stopped while **Start round** prepares the shared
microphone and judge. **Cancel setup** cancels preparation; **End round** stops and drains capture.
This single action uses the standard gallery header slot, and the header/data-handling badge
come from gallery metadata. Rounds require microphone input and an inference connection.
Developer builds use Configure models
for inference settings; managed hosts use the existing `connectModel` contract. The text model
extracts answer candidates; Jev judges each candidate with a yes/no probability (initial cutoff
0.5). Brainstorming requires the connection's optional `decisions` transport alongside chat.
The reference preview host discovers that capability from the deployed proxy's config and uses
`/api/alpha/decisions` with the same verified session, allowance, and cancellation as chat.
OpenRouter BYOK supplies pinned `typesafe/jev-1.13`; custom chat endpoints do not implicitly
enable decisions or send their keys to OpenRouter. Chat-only hosts continue supporting other
text-generation demos; brainstorming reports the missing Jev connection before revealing a challenge.
Changing the
inference source or preview mode aborts judging and ends the current round while retaining its
board. The next explicit Start prepares the new connection. **Run locally** offers a pinned copy
of the standalone example. The named
`brainstormGalleryDemo` export is available to embedding hosts; standalone gallery copies carry
the game's source and challenge library.

## Build and inspect

```sh
pnpm build:pkgs
pnpm --filter @katakit/gallery build
pnpm --filter @katakit/gallery tsc
pnpm --filter @katakit/gallery preview
```

Open <http://127.0.0.1:4348>. The `preview` command serves the last built artifact using the local
Workers runtime; it does not select the gallery mode. A normal build is public. No Cloudflare
login or credentials are needed for local development or serving a local build.
Build libraries explicitly before the gallery: dependency filters can omit local packages
while the examples' registry pins lag behind local versions.
The gallery build itself does not rebuild shared assets while sibling apps may be copying them.

The `pnpm-workspace.yaml` build allowance for `workerd` installs the local runtime binary.

Both dev and built responses set COOP `same-origin` and COEP `require-corp`. These apply to the
first document, including the directory. The transcription package supplies runtime files under
`dist/client/transcription-assets/`; workers and model files must remain accessible with the
expected content types. Models download on Download model or an explicit microphone action; microphone audio stays local.

## Reuse from another host

`shared/galleryDemoDetails.ts` is the eligible React catalogue, including stable IDs, names,
descriptions, source paths, and required capabilities. `shared/galleryDemos.tsx` adds lazy component loaders.
The catalogue is a manually maintained, typed build input. Every entry also declares
`dataHandling: { audio: 'device', transcribedText: 'device' | 'cloud' }`; update it when the
demo's data flow changes. `Gallery` uses those facts for its upper-right On-device or
Cloud-assisted badge and two-row privacy popover. These describe the demo's behavior, not
connection readiness or current network activity. No source scanning or runtime probing is used.

The popover uses Lucide shields and opens on hover, keyboard focus, or a tap. Escape or an
outside interaction dismisses it; keyboard users can reach the privacy link without closing
the panel. Its right-aligned policy link uses the host's `privacyUrl` and opens separately.
Hosts may supply `cloudPrivacyDescription` for a verified managed-service promise, for example
“Transcribed text is processed on secure servers.” The default only describes cloud processing;
the reference host has no managed service and makes no security claim. Developer key connections
always use neutral configured-service wording, ignoring any host promise. The gallery does not
verify endpoint security, retention, or model-provider policies.

Entries with their own example directory also declare `copyDirectory`. `Gallery` gives those demos
a **Get the code** control beside the data-handling badge: a **View the source code for this example** link, an `npx degit`
command that copies the example directory and starts it, and a prompt that asks a coding agent to do the same. For demos with the
`remoteModel` capability its panel says the copy needs your own model API key. Pass `sourceRevision`
with the Katakit commit the host's demos come from, so the source link and local copy match the demo
the visitor used; without it they use the default branch. Hosts should remove their separate source
link for these demos when adopting this revision. Copying reports `runLocallyCopied` with which
text was copied. Color Clash lives inside the gallery and has no control.

A host can select metadata and render `shared/Gallery.tsx` without importing recognizers or this
app's bootstrap. Import `shared/gallery.css` for the scoped presentation. It owns the gallery’s
inner type scale, spacing, control styles, and demo layout resets while using the host’s font and
palette tokens. It does not import a global reset.

The default local gallery uses the Katabase website’s adapted **Cobalt** theme in both light and
dark modes. `shared/theme.css` provides that application-level skin: cool paper surfaces, Inter
body type, Plus Jakarta Sans display type, JetBrains Mono code, and raised 44px controls. The local header’s theme switch saves a preference in this browser; otherwise it uses the OS
color preference. Hosts can set `data-theme="light"` or `data-theme="dark"` on the root.
The gallery itself uses body type for its headings, matching the website’s gallery adaptation.
Theme tokens come from the website’s `tokens.css` and `styles.css` at revision
`869ac4dff3382b8b35cd9b67affd043c5c07f294`; no private website modules are imported.

A host that wants those defaults can also import `shared/theme.css` and serve the supplied
`public/fonts/` assets at `/fonts/`. The font files retain their SIL Open Font Licenses beside them.
A host with its own theme imports only `shared/gallery.css` and supplies the existing `--color-*`,
`--font-*`, and optional `--shadow-key*` tokens. Keep palette/branding changes in those tokens;
keep gallery layout rules in the shared stylesheet so local and embedded views stay consistent.
The standalone gallery copy includes the skin, fonts, licenses, and all imported CSS.

Pass the chosen entries, active entry, a host link renderer, and active content to `Gallery`.
Pass `GallerySpeechControls` through its `input` slot for shared microphone, account, and usage controls in both modes. Public visitors cannot select a provider, enter a key, or override a model. Launch
defaults use the delivered recognizer without an upfront model picker. Welcome and
the demo views render `GalleryCaptureControls` beside their content. Pass an absolute `privacyUrl`
to link to the host’s policy in a separate tab (`noopener noreferrer`); independent hosts may omit
it or supply their own. The local reference host passes `https://katabase.com/privacy`; Katabase’s
website host should pass the same URL. Its current 404 is tracked in the website integration issue.
Hosts supply `termsUrl` to show Terms of Service beside Privacy Policy on Welcome and public
Settings, and “By continuing, you agree to our Terms of Service.” below each primary capture
button. The link opens separately with `noopener noreferrer`. Secondary Pause, Stop, and Cancel
actions do not show the notice. Embeds outside `Gallery`, such as a homepage game, can wrap their
content in `GalleryTermsContext` with their own Terms URL; `Gallery` inherits that URL when its
prop is omitted. No policy link is invented for hosts without a URL. The reference host supplies
`https://katabase.com/Terms`. Both policy URLs belong to the host.
Mount `GalleryConsentProvider` once above the route outlet and any standalone embeds. The first
primary click hides the notice across those views, even if microphone setup fails. Acceptance
is stored in `sessionStorage` for this tab's visit and survives navigation and reloads. If storage
is blocked, the mounted provider remembers it until the page reloads. Opening the Terms link,
secondary actions, and disabled buttons do not accept the notice. Hosts without this provider
continue to show the notice on every primary action.
Each host owns its URLs, title metadata, not-found/loading/error handling, and router registration.
Adding an entry here makes it eligible; each consuming website still chooses what to include.
Examples continue to own their code and never import private website components.

## Stable demo transitions

Gallery renders the real demo title, description, and privacy badge from metadata before loading
the demo. `GalleryDemoHeader` keeps this header in place through loading and readiness: 36px titles
on desktop, 28px on mobile, 12px between title and description, and 32px before the demo body.
The badge sits beside the title on desktop and below the description on mobile. Content starts
32px below the gallery edge on desktop and 24px on mobile. Standard adapters suppress their embedded
introductions when this header is present; standalone views retain their original introductions.

Welcome uses the same immediate header and delayed loading frame. Its title and introduction
are available before the lazy page code. Page readiness follows code/hydration; microphone setup,
permission prompts, and speech-model downloads keep their own feedback inside the visible page.

`Gallery` keeps one `shared/GalleryDemoFrame.tsx` mounted across Welcome and demo navigation.
It owns the lazy-component Suspense boundary and one loading treatment for code loading and
runtime attachment. A frame used outside Gallery supplies the real header itself. The local
Start host supplies only the active component to Gallery:

```tsx
<Gallery activeDemo={demo} /* ...host links and settings */>
  <ClientOnly fallback={null}>
    <Component />
  </ClientOnly>
</Gallery>
```

`ClientOnly` is this host's hydration guard; browser-only hosts can render the component directly.
Avoid another loading heading or Suspense fallback inside Gallery. Keep host error boundaries
outside it. Standard demo entries use `GalleryDemo`, which reports readiness after its runtime
lease settles; custom adapters using a different lease must call `useGalleryDemoReady(settled)`.
Runtime initialization failures become visible errors rather than permanent loading states.

The frame measures the settled demo body, including later size changes, and temporarily reserves
that height while switching demos. The reserved space is quiet for the first 250ms. Longer waits
show a 16px activity ring and muted “Opening…” text at the top-left of the body. Content is revealed
as soon as its lease settles; it is never delayed to finish an animation. Timers are cleared on
readiness, navigation, and unmount. The ring becomes static for reduced-motion preferences, and the
status message is separate from the busy/hidden incoming content so assistive technology can announce it.

Incoming content stays hidden until its lease settles. Once ready, the reservation is removed and
the body takes its natural responsive height. Resize observers disconnect on transition/unmount.
Only the outgoing dimensions are retained: the old component unmounts and its runtime still stops,
drains, and closes before the incoming runtime is created. This does not preload speech models,
start capture/inference, retain inactive demos, or change individual games.

## Shared input and separate demo runtimes

Mount `GallerySpeechProvider` once above the route outlet. It owns one `@katakit/transcription`
microphone transcriber and the inference-settings provider. The same footer sits at the bottom
of the shared sidebar in both modes, outside demo navigation, and becomes a measured bottom strip on phones.
Both modes include a round Settings button. Public Settings (`/settings`) focuses on signup/account
access, demo allowance, and privacy. Developer Settings opens Configure models; Configuration/Grid route
tabs above those pages switch between the two developer views.
The footer has no microphone status. The live audio level fills the microphone glyph beside a demo's Start button and
Welcome's microphone glyph. Download, cancel,
and recording actions stay in Welcome, the demo, or developer Configure models.
Download model leaves the microphone off, including without a demo attachment. Welcome’s Set up
microphone downloads the speech model if needed, then requests microphone permission.
Its button label and feedback text show where setup stands; there is no separate readiness icon.
The passive microphone glyph reflects capture and live audio levels; the adjacent button owns setup,
cancellation, testing, and stopping. Stopping capture retains readiness for this host session.
Setup progress and recovery guidance appear beside the action button. A download confirmation
remains visible after loading, including during permission setup and after stopping; selecting a
different model resets that confirmation. The transcript field stays visible throughout setup.
Listening belongs to each demo. Its button sits at the left, below the description and above the
body heading: a primary Start, then a secondary Pause, beside a microphone glyph that fills with
the level being heard. Mouse controls are 36px high; touch controls remain 44px. Setup progress
follows the button.
Welcome, listening demos, Color Clash, and Brainstorm all render their primary buttons through
`GalleryCaptureControls`. Its default and Welcome presentations use the shared speech owner.
The controlled `action` variant renders the same button in place using the caller's label,
disabled state, and click handler; it does not require a speech provider. Both games use this
variant for game actions while keeping round timing and permission guidance inside each game.
Their clocks start only after capture is running, and finishing stops capture.
A demo's own controls stay inside the demo. Get the code and the
data-handling badge sit at the header's top right, level with the top of the title.
Models load only after a visitor action. Standalone controls
remain independent. Navigation retains the loaded model but stops capture.
Each view acquires a runtime lease. Release keeps the outgoing sink attached through stop/drain and
flush, closes its runtime, then permits the next factory to run. The next demo starts idle with no
previous transcript. Hiding the tab stops capture; root teardown disposes the helper. A pending
start is cancelled through utility disposal so navigation during loading cannot later prompt for a
microphone. Failed downloads remain visible and retryable.

Core has no universal runtime teardown API. Transcription and Bingo start no asynchronous core
effects: they own explicit subscriptions, complete their projections, and close transcript timers.
Bingo uses its synchronous transcript bridge and state-completion method. Their focused tests verify
separate histories, final-result ordering, timer cleanup, model retention/replacement, cancelled
attachments, load retry, and Strict Mode cleanup. Standalone entry points own local capture using
the same instance-owned views; they do not import this gallery.

A host that measures usage passes `onEvent` to `GallerySpeechProvider`; see
`shared/galleryEvents.ts` for the events. The speech owner reports model changes, model-download
outcomes, microphone requests and answers, and each recording's duration and finalized segment
count. Gallery adapters report the demo actions they own, and the demo frame reports which kind
of control was clicked inside a demo. Each event carries the active demo's ID; a recording keeps
the demo it started in. Events hold keys, error codes, counts, and durations only. They never
hold audio, transcript text, prompts, model output, or control labels. A handler that throws does
not affect capture. The local host passes no handler.

A host passes one `connectModel` to `Gallery` for its model admission/transport; see
`shared/galleryModel.tsx` for the contract. Every entry with the `remoteModel` capability uses it,
so a new such demo needs no host code. Without a connection, the footer's Settings button opens a
notice that inference is unavailable; pressing it opens Settings. Each demo determines which
on-device features remain usable without inference. Public mode never falls back to a saved developer key. Every demo link stays clickable. Hosts throw `GalleryModelError` for failures they
want shown or retried. Connection controls, browser verification, and errors render
inside the active demo. Host `onAllowance` reports drive the shared footer’s “Usage” bar: the percentage
of allowed model calls used, yellow at 80% and red at 100%. On-device transcription does not consume
model calls. The reported value survives demo navigation under `GallerySpeechProvider`, but source/configuration
and mode changes clear it. Without valid data the footer shows no usage row, and Settings shows “Usage unavailable” with an explanation;
there is no sample or predicted usage. Without CI preview deployment configuration, the reference host has no managed allowance service, and
developer-key providers do not report a demo allowance. No usage request is made on page load.

With a personal key selected, “Usage” shows the session’s input and output token total instead of a
bar. It sums `usage.total_tokens` from received chat-completions responses, including responses a demo
rejects and retries. Missing or invalid totals mark the count as incomplete, shown as “≥” or
“Unavailable” when no tokens have been reported. Canceled requests can consume tokens that are not
reported here. The count survives demo navigation and key/model/source changes in this tab, stays
hidden in public preview, and resets on page reload. It is kept in memory, never local storage.
Neither mode estimates usage or makes a usage request on page load.

The optional `Gallery account` prop supplies a host-owned `waitlistUrl`, or signed-in identity
`user: { name, avatarUrl? }` and a real `onOpenAccount` callback. Guests get a direct **Join the
waitlist** link in the footer and Public Settings when the host supplies a destination. There is
no guest signup or sign-in menu, and missing destinations do not create placeholder actions.
Signed-in users see their image or initials and their real account action. Public Settings shows
their account summary and **Manage account**. The reference host links to
`https://katabase.com/waitlist`; embedding hosts own their destination. Pass `settingsPage` to render this shared page, and
`onOpenSettings` for mode-appropriate host navigation; developer operation recovery keeps its
separate `onConfigureOperation` callback. Neither the public page nor its navigation enables BYOK.

Plain hover text uses `GalleryTooltip` for custom triggers (including the header switch), or
`GalleryTooltipButton` for buttons. Both share hover, focus, tap, Escape, and outside-pointer
dismissal. Side/alignment options position the panel; local CSS variables control sizing.
`galleryTooltip.css` owns the panel surface and caret for tooltips and privacy/account popovers.
Those interactive popovers retain their own link navigation, pinning, dismissal, and focus behavior.
The shared tooltip scopes its own header styles outside the gallery grid, with no global reset.

With inference configured, notes start when listening begins: that admits a remote connection and
starts sending finalized transcript text. There is no separate notes control. Stop/start capture
reuses the connection. Source changes, saving overrides, and key removal abort remote work and
retain local content; a demo that is still listening reconnects through the new source. Route exit aborts admission and model work before capture drains.
See [the notes example](../notes-react/README.md) for the generic contract.

## Developer mode and public preview

Gallery mode controls the UI and inference policy independently of build optimization:

| How the gallery runs                             | Gallery experience                                    |
| ------------------------------------------------ | ----------------------------------------------------- |
| Vite dev server (`pnpm -F @katakit/gallery dev`) | Developer                                             |
| Normal production build                          | Public                                                |
| Build with `VITE_GALLERY_DEV_MODE=true`          | Developer, in an optimized build                      |
| Hosted PR deployment                             | Developer, with the header's Preview toggle           |
| Header Preview enabled in a developer build      | Public experience, with the toggle retained to return |

Three uses of “preview” have different meanings: the header's **Preview** toggle changes the live
gallery experience; `pnpm preview` serves an existing build locally; a hosted PR preview deploys a
build for review. Neither local serving nor the deployment URL itself selects the gallery mode.

The shared gallery defaults to public mode. BYOK, Configure models/Grid, and developer recovery
controls exist only inside a host’s explicit `GalleryModeProvider developerMode={true}` opt-in.
Mount that provider inside `GallerySpeechProvider`, above the header and route outlet. Hosts own
their developer links/routes and pass `developerPage`, `renderDeveloperLink`, and
`onConfigureOperation` to Gallery. `GalleryPreviewToggle` belongs beside the host’s theme switch.
Public website builds should omit the developer opt-in; URL and local-storage flags cannot enable it.
The provider owns `isPublicPreview` and derives `isDeveloperView = developerMode && !isPublicPreview`.
UI controls and connection selection use that same effective policy; host route guards additionally
check whether the build supports developer tools.

The reference host's `src/galleryEnvironment.ts` enables developer mode on the Vite dev server or
when `VITE_GALLERY_DEV_MODE=true` is set at build time. Normal builds are public. `pnpm preview`
serves the mode compiled into the last build; setting the flag only when serving cannot change it.
To review an optimized developer build locally:

```sh
VITE_GALLERY_DEV_MODE=true pnpm -F @katakit/gallery build
pnpm -F @katakit/gallery preview
```

The PR deployment workflow sets this flag for gallery review builds. Omit it for public production
deployments. `/operations/setup` and `/operations/grid`
redirect to Welcome in public builds. In a developer build, the header’s Preview toggle switches
the live gallery into public mode. It hides developer tools and ignores developer keys, retaining
the toggle as the way back. Entering preview from a tools page opens Welcome; leaving returns to
that tools page. From a demo, the same local content remains; inference stops in both directions,
and a listening demo reconnects through the new mode's connection. Saved developer settings survive. Unsaved form edits are
ordinary page-local drafts.

Preview uses the current host’s real managed inference contract. It does not create a proxy,
account, or free allowance: a local host without that service shows the public missing-service
state rather than quietly using a developer key. Navigation into Configure models is ordinary route
navigation, so it stops/drains the outgoing demo. The loaded speech model and saved settings remain.

## Developer operation setup

Under the Vite dev server, developer view uses the notes example's dev-server model connection
(`examples/demos/notes-react/inference/`). The reference host passes `localInference` to `Gallery`
from `src/galleryEnvironment.ts`. The notes demo and Configure models then show the same setup
panel as the standalone example, and the footer shows the tokens your key has used. The key stays
on the dev server and is saved outside the checkout. The browser-direct form below remains for
developer builds without a dev server, such as hosted PR previews and `pnpm preview`.
The Brainstorming game also judges answers with OpenRouter's decision model, which the dev server
offers only for an OpenRouter key; with another provider's key it explains that it needs one.

Configure models groups supported work under Audio and Language. Transcription uses the delivered
local model catalogue with a download-only action. Without the dev server, Inference offers the
host’s Free demo or a personal OpenRouter key. The API key and model ID are visible together; only the full endpoint override is
under collapsed Advanced. Defaults are `z-ai/glm-5.3` and
`https://openrouter.ai/api/v1/chat/completions`. The key authorizes an account; the model ID chooses
what runs. Structured notes needs JSON schema output. Setup saves configuration without making
an inference request.

Operation Grid derives requirements from the same selected demo catalogue. It distinguishes required
and configured, required but missing a connection, and not used. Configured means a selection exists;
downloads, microphone permission, provider credentials, and availability are checked on use. All
current demo links remain clickable. Additional operations pictured in earlier mockups are future
integrations, not placeholder controls in these pages. Account actions are a separate host integration
through the shared footer, not inference configuration.

Developer-key endpoints must support chat completions with JSON schema output and browser CORS.
HTTPS is required except for loopback HTTP endpoints; URL credentials, queries, and fragments are
rejected. Requests send the key and transcript directly to the chosen endpoint, omit cookies/referrers,
and reject redirects. They never call host admission or consume its allowance. Failures pause notes;
there is no automatic fallback. Raw provider/fetch errors never reach diagnostics.

As agreed, developer key/source/model/endpoint settings persist in **localStorage** under
`katakit.gallery.inference.v1`, surviving refresh and tab closure on that origin. Remove key deletes
the record. Cross-tab changes invalidate requests and reset open forms so stale drafts cannot restore
a removed key. Public mode and public preview ignore the record. If storage is blocked, save/removal
reports an error instead of claiming success.

Run `pnpm --filter @katakit/gallery test:ci`. Controlled tests cover public-mode key isolation,
preview cancellation/late results, explicit restarts, retained content/settings, grid requirements,
source changes, persistence/removal, missing-host/exhaustion, and request/response handling. They do
not establish live microphone behavior, provider quality, or the private host’s verification/allowance.
Website integration and real-host acceptance remain in Protozoa #2265.

The local host resolves workspace source for development. A consuming website must record its
source SHA and actual built library dependencies, test released versions when selected, and use
one React runtime. Gallery-only source updates do not require a library release.

## Hosted PR previews

GitHub Actions builds this same Start app and deploys its generated Worker configuration at
`dist/server/wrangler.json`, including `dist/client/` and `transcription-assets/`. Direct demo
links and unknown routes are handled by Start rather than an HTML fallback. `public/_headers`
supplies document and runtime isolation headers. The workflow sets `VITE_GALLERY_DEV_MODE=true`
only for the gallery PR build, so reviewers can use developer tools and the header's Preview toggle
to inspect the public experience. The CI deployment can supply managed inference through the existing ProtoZoa demo proxy; see the preview setup below.
Normal production builds remain public. See the repository's
[preview setup](../../../.github/PREVIEWS.md).

### Managed inference in CI deployments

Same-repository gallery PR builds receive `VITE_GALLERY_DEMO_PROXY_URL` and an exact
`VITE_GALLERY_PREVIEW_ORIGIN`. The host offers the managed connection only on that deployed origin,
in both developer and public views. Neither the header toggle nor visitor storage enables it.
Ordinary local and production builds omit this configuration. Sessions, verification, cancellation,
server-reported allowance and errors follow the website's anonymous demo flow; the existing proxy
and website budget are shared. No account sign-in or provider key is required from the reviewer.
See [the one-time Cloudflare setup](../../../.github/PREVIEWS.md#managed-inference-for-every-gallery-pr-preview).

Gallery CI deploys a native Worker Preview named `pr-<number>`, served at
`https://pr-<number>.katakit-preview.katabase.com`, and removes it when the PR closes. The
parent custom domain is enabled for Preview traffic only. Local builds do not create or
configure domains. Docs previews retain their workers.dev version aliases.
