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

The copy includes built Katakit tarballs and local dependency overrides while the libraries
are unpublished. Keep `vendor/` with it. The gallery also carries its composed demo sources under `sources/` and plain shared CSS under `styles/`.
No original checkout is needed after copying. Follow the platform and hosting instructions below.

This is the local TanStack Start host for the React demo gallery. It runs without the private
website, account credentials, or a model-provider key. Install dependencies from the Katakit root:

```sh
pnpm install --frozen-lockfile
pnpm -F @katakit/gallery dev
```

Open <http://127.0.0.1:4347>. Welcome is `/`; React demos are at `/demos/transcription`,
`/demos/bingo`, and `/demos/notes`. Notes transcription runs locally; generating notes requires
a host-supplied model connection or your own OpenRouter key. Extension setup pages are outside this catalogue. Direct links and unknown-demo
responses are handled by Start. Browser-only demo modules mount after hydration, not during SSR.

## Build and inspect

```sh
pnpm --filter @katakit/gallery... build
pnpm --filter @katakit/gallery tsc
pnpm --filter @katakit/gallery preview
```

Open <http://127.0.0.1:4348>. The built preview uses the local Workers runtime; no Cloudflare login
is needed. No Cloudflare credentials are needed for local development or preview.
Use `pnpm --filter @katakit/gallery... build` to build the gallery and its upstream packages in dependency order.
The gallery build itself does not rebuild shared assets while sibling apps may be copying them.

The `pnpm-workspace.yaml` build allowance for `workerd` installs the local runtime binary.

Both dev and built responses set COOP `same-origin` and COEP `require-corp`. These apply to the
first document, including the directory. The transcription package supplies runtime files under
`dist/client/transcription-assets/`; workers and model files must remain accessible with the
expected content types. Models download on Download model or an explicit microphone action; microphone audio stays local.

## Reuse from another host

`shared/galleryDemoDetails.ts` is the eligible React catalogue, including stable IDs, names,
descriptions, source paths, and required capabilities. `shared/galleryDemos.tsx` adds lazy component loaders.
A host can select metadata and render `shared/Gallery.tsx` without importing recognizers or this
app's bootstrap. Import `shared/gallery.css` for the scoped presentation; it inherits host colors
and typography and does not import the global shared reset.

Pass the chosen entries, active entry, a host link renderer, and active content to `Gallery`.
Pass `GallerySpeechControls` through its `input` slot for the two compact Transcription/Inference
rows. Launch defaults use the delivered recognizer without an upfront model picker. Welcome and
the demo views render `GalleryCaptureControls` beside their content. Pass an absolute `privacyUrl`
to link to the host’s policy in a separate tab (`noopener noreferrer`); independent hosts may omit
it or supply their own. The local reference host passes `https://katabase.com/privacy`; Katabase’s
website host should pass the same URL. Its current 404 is tracked in the website integration issue.
Each host owns its URLs, title metadata, not-found/loading/error handling, and router registration.
Adding an entry here makes it eligible; each consuming website still chooses what to include.
Examples continue to own their code and never import private website components.

## Shared input and separate demo runtimes

Mount `GallerySpeechProvider` once above the route outlet. It owns one `@katakit/transcription`
microphone transcriber and the inference-settings provider. The two compact setup rows sit at the
bottom of the shared sidebar, outside navigation, and become a measured bottom strip on phones.
Download model leaves the microphone off, including without a demo attachment. Welcome’s Test
transcription can download first and then request microphone permission. Start/Stop listening
belongs inside each demo. Models load only after a visitor action. Standalone controls remain
independent. Navigation retains the loaded model but stops capture.
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

A host passes one `connectModel` to `Gallery` for its model admission/transport; see
`shared/galleryModel.tsx` for the contract. Every entry with the `remoteModel` capability uses it,
so a new such demo needs no host code. With a connected host, Free demo is the default; without
one, the footer offers Add API key and notes explains the missing connection while transcription
remains usable. Every demo link stays clickable. Hosts throw `GalleryModelError` for failures they
want shown or retried. Connection controls, browser verification, allowance, and errors render
inside the active demo, not the setup footer.

Only **Start notes** admits a remote connection and starts sending finalized transcript text.
Starting capture never starts inference. Stop/start capture reuses the connection. **Pause notes**,
source changes, saving overrides, and key removal abort remote work and retain local content;
Start notes is required to resume. Route exit aborts admission and model work before capture drains.
See [the notes example](../notes-react/README.md) for the generic contract.

## Optional visitor key

Inference opens a keyboard-accessible native dialog. My API key starts with OpenRouter,
`z-ai/glm-5.3`, and `https://openrouter.ai/api/v1/chat/completions`. Model ID and full endpoint
URL overrides are under collapsed Advanced. Endpoints must support chat completions with JSON
schema output and browser CORS. HTTPS is required except for loopback HTTP development endpoints;
URL credentials, query strings, and fragments are rejected. Requests send the key and transcript
directly to the chosen endpoint, omit cookies/referrers, and reject redirects. They never call
host admission or consume its free allowance. Provider failures pause notes and require an action;
there is no automatic fallback to host inference. Raw provider/fetch errors never reach diagnostics.

As agreed for this interface, the key, source, model, and endpoint persist in **localStorage**
under `katakit.gallery.inference.v1`, surviving refresh and tab closure on that origin. Remove key
removes the saved record and returns to the host default. Changes in other tabs invalidate active
requests too. If storage is blocked, saving/removal reports an error instead of claiming success.
No signup, private website dependency, or analytics service is required.

Run `pnpm --filter @katakit/gallery test:ci` from the root. Controlled tests cover explicit starts,
late-result cancellation, source changes, persistence/removal, missing-host/exhaustion behavior,
and real request serialization/response validation. They do not establish live microphone behavior,
provider model quality, or a private host’s browser verification and allowance integration. Verify
those separately when consuming this source revision; website acceptance is tracked in Protozoa #2265.

The local host resolves workspace source for development. A consuming website must record its
source SHA and actual built library dependencies, test released versions when selected, and use
one React runtime. Gallery-only source updates do not require a library release.

## Hosted PR previews

GitHub Actions builds this same Start app and uploads its generated Worker configuration at
`dist/server/wrangler.json`, including `dist/client/` and `transcription-assets/`. Direct demo
links and unknown routes are handled by Start rather than an HTML fallback. `public/_headers`
supplies document and runtime isolation headers. See the repository's
[preview setup](../../../.github/PREVIEWS.md).
