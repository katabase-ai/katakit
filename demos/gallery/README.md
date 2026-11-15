# Demo gallery

This is the local TanStack Start host for the React demo gallery. It runs without the private
website, account credentials, or a model-provider key. Install dependencies from the Katakit root:

```sh
pnpm install --frozen-lockfile
pnpm -F @katakit/gallery dev
```

Open <http://127.0.0.1:4347>. The directory is `/`; React demos are at `/demos/transcription` and
`/demos/bingo`. Extension setup pages are outside this catalogue. Direct links and unknown-demo
responses are handled by Start. Browser-only demo modules mount after hydration, not during SSR.

## Build and inspect

```sh
pnpm --filter @katakit/gallery... build
pnpm --filter @katakit/gallery tsc
pnpm --filter @katakit/gallery preview
```

Open <http://127.0.0.1:4348>. The built preview uses the local Workers runtime; no Cloudflare login
is needed. There are no production routes or deployment credentials in this app. The
`pnpm-workspace.yaml` build allowance for `workerd` installs the local runtime binary.

Both dev and built responses set COOP `same-origin` and COEP `require-corp`. These apply to the
first document, including the directory. The current Moonshine helper copies runtime files into
`dist/client/assets/moonshine/0.1.5/`; workers and model files must remain accessible with the
expected content types. Models download on explicit recording; microphone audio stays local.

## Reuse from another host

`shared/galleryDemoDetails.ts` is the eligible React catalogue, including stable IDs, names,
descriptions, and required capabilities. `shared/galleryDemos.ts` adds lazy component loaders.
A host can select metadata and render `shared/Gallery.tsx` without importing recognizers or this
app's bootstrap. Import `shared/gallery.css` for the scoped presentation; it inherits host colors
and typography and does not import the global site-ui reset.

Pass the chosen entries, active entry, a host link renderer, and active content to `Gallery`.
Each host owns its URLs, title metadata, not-found/loading/error handling, and router registration.
Adding an entry here makes it eligible; each consuming website still chooses what to include.
Examples continue to own their code and never import private website components.

## Pending shared-input handoff

This branch prepares the gallery before the standalone utility in Katakit PR #28 is available.
The local host still runs the existing demo implementations. They own separate legacy model
selectors and module-level Katakit runtimes; there is no shared model session yet. Navigation
between demos intentionally reloads the document to preserve the previous app's teardown behavior.
The public and private hosts must not switch these legacy runtimes through client navigation.

After PR #28, integrate `@katakit/transcription` and `@katakit/transcript-ingestion`, supply a shared
microphone transcriber to instance-owned demo views, and verify stop/drain/detach/runtime cleanup
before enabling client navigation. Core currently exposes no universal runtime disposal API;
closing the ingestion plugin does not establish that effects or pending handlers are released.
No replacement capture/recognition code or speculative disposal API is supplied here.

The local host currently resolves library workspace source, recorded by its Git revision and frozen
lockfile. That is development provenance, not proof against released package versions. A consuming
website must record its source SHA and actual library dependencies and test released versions when
those are selected. Gallery-only source changes do not require a new library release.
