# Demo gallery

This is the local TanStack Start host for the React demo gallery. It runs without the private
website, account credentials, or a model-provider key. Install dependencies from the Katakit root:

```sh
pnpm install --frozen-lockfile
pnpm -F @katakit/gallery dev
```

Open <http://127.0.0.1:4347>. The directory is `/`; React demos are at `/demos/transcription`,
`/demos/bingo`, `/demos/color-clash`, and `/demos/notes`. Notes transcription runs locally; generating notes requires
a host-supplied model connection. Extension setup pages are outside this catalogue. Direct links and unknown-demo
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
expected content types. Models download on explicit recording; microphone audio stays local.

## Reuse from another host

`shared/galleryDemoDetails.ts` is the eligible React catalogue, including stable IDs, names,
descriptions, source paths, and required capabilities. `shared/galleryDemos.tsx` adds lazy component loaders.
A host can select metadata and render `shared/Gallery.tsx` without importing recognizers or this
app's bootstrap. Import `shared/gallery.css` for the scoped presentation; it inherits host colors
and typography and does not import the global site-ui reset.

Pass the chosen entries, active entry, a host link renderer, and active content to `Gallery`.
Pass `GallerySpeechControls` through its `input` slot; demo views receive no extra microphone or
model selector. A host can provide its own model-select renderer to these shared controls.
Color Clash starts capture through its Play action; hosts set `showCaptureControls={false}`
on the sidebar controls for that view to retain model setup without another start button.
Each host owns its URLs, title metadata, not-found/loading/error handling, and router registration.
Adding an entry here makes it eligible; each consuming website still chooses what to include.
Examples continue to own their code and never import private website components.

## Shared input and separate demo runtimes

The mounted `GallerySpeechProvider` owns one `@katakit/transcription` microphone transcriber and
selected model. Controls sit at the bottom of the shared sidebar, outside the keyed demo view, and become a bottom strip on phones. The transcription entry explains local recognition and teaches these actual controls; standalone demo controls remain independent. Controls use the package catalogue/default. Models load only after Load/Start;
changing models is disabled while recording. Navigation retains the loaded model but stops capture.
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

The notes entry accepts a `connect` prop for the host's model admission/transport. **Start notes**
invokes it explicitly; shared microphone actions alone never send transcripts. The notes view
aborts admission and model work on unmount before its capture drains. Its runtime closes the
notes effect stream explicitly. See [the notes example](../notes-react/README.md) for the contract.

Run `pnpm --filter @katakit/gallery test:ci` from the root. Each host owns its route registration.
No authentication or analytics service is required. Public defaults use site-ui controls; the
private website can supply its own model-select renderer without changing the public examples.

The local host resolves workspace source for development. A consuming website must record its
source SHA and actual built library dependencies, test released versions when selected, and use
one React runtime. Gallery-only source updates do not require a library release.

## Hosted PR previews

GitHub Actions builds this same Start app and uploads its generated Worker configuration at
`dist/server/wrangler.json`, including `dist/client/` and `transcription-assets/`. Direct demo
links and unknown routes are handled by Start rather than an HTML fallback. `public/_headers`
supplies document and runtime isolation headers. See the repository's
[preview setup](../../.github/PREVIEWS.md).
