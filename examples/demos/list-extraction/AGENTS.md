# List extraction example

The [README](README.md) introduces the feature. This guide covers an independent copy.
Use Node.js 24+ and pnpm 11.9.0. From a checkout, run
`pnpm examples:copy demos/list-extraction <destination>`, then `pnpm install`, `pnpm build`,
and `pnpm dev` inside the copy. Alternatively, use
`npx degit katabase-ai/katakit/examples/demos/list-extraction list-extraction`, then install
and run there. In the checkout, run `pnpm build:pkgs` followed by
`pnpm -F @katakit/demo-list-extraction dev`. The copy owns its assets, runtime configuration,
and registry dependencies; no gallery, sibling demo, or private package is required.

For standalone inference, put `VITE_EXTRACTION_ENDPOINT` and `VITE_EXTRACTION_CREDENTIAL` in
an ignored `.env.local`. The endpoint needs browser CORS, chat completions, and JSON-schema
output. The default model is `z-ai/glm-5.3`. Vite variables are browser-visible; only use
personal credentials with the local host. Public hosts supply `connect` for admission and
transport. Without inference, local dictation and **Try sample** still work. The Vite plugin
installs transcription assets and COOP/COEP headers for dev/preview. Production needs HTTPS,
document COOP `same-origin`, document/worker COEP `require-corp`, and deployed
`transcription-assets/`. English speech models download on first use.

## Code organization and feature behavior

The copyable feature owns its rules, extraction schema/prompt, source validation, and view.
`extractionPlugin.ts` projects durable content from the event log. `createListExtractionDemo.ts`
owns one visit's cancellable on-demand admission/request and transcript resources.
`ListExtractionDemo.tsx` binds runtime observables with React-RxJS. `App.tsx` owns standalone
capture; the gallery adapter lives in the gallery and supplies shared capture/model controls.
`main.tsx` owns the standalone transport and imports `standalone.css`; `style.css` is scoped
feature styling. Tests live in `tests/`. Do not move global defaults into the reusable view.

**Try sample** loads labeled transcript and results without capture or admission. It must not
overwrite real speech. **Use my own dictation** clears the fixture without starting a model
request; **New dictation** requires confirmation before clearing real content. Recording upload
is deferred; do not add its controls. The output sits beside a numbered, timestamped live
transcript on wide screens and stacks below it on narrow screens. Estimated timestamps are not
audio alignment. **Extract lists** is deliberate and on demand; changes to rules or speech
leave previous accepted results visible as stale until the next extraction.

Do not start inference on capture, new turns, replay, or rule edits. Preserve the last accepted
results on failure. Validate every source before recording any returned items. Quotes must be
contiguous exact transcript excerpts. Rules, accepted IDs, evidence, edits, and removal/undo
belong in the log; requests, cancellation, form disclosure, selection, and clipboard state do not.

Keep terminal allowance failures through clear and sample operations. Source changes and unmount
abort model work immediately. Standalone unmount currently closes the runtime before the
microphone hook finishes asynchronous disposal; final recognition may not be delivered. The TODO
in `App.tsx` tracks coordinating stop/drain, flush, and close. Late results must be discarded,
including from a host that ignores AbortSignal. Do not add upload controls to
the dictation-only version. The built-in sample is a labeled fixture, never a fallback for real
model processing or a replacement for existing user speech.

`runtime.events$.getAll()` returns recorded events including metadata. Supply those as
`initialEvents` to restore content, with payload and metadata validation and JSON timestamps
restored to `Date`. Replay does not call a model, allocate replacement IDs, or restart capture.
Source evidence must reference a known turn and a contiguous exact transcript excerpt; quote
mode preserves the original speech. Equivalent items merge within each list while retaining
separate source occurrences. Correctness of categorization still needs human review.

The host's `connect({ signal })` supplies model, `maxBodyBytes`, `maxOutputTokens`,
`requestCompletion({ body, signal })`, and optional failure reporting. Malformed or incorrectly
sourced output fails atomically without replacing accepted items. Inference begins only on
**Extract lists**; it never silently retries or resumes. The host owns authorization, credentials,
and provider errors. Terminal allowance failures survive clear and sample operations.
The standalone drain-before-close gap above remains; source changes and unmount abort requests
and reject late responses even if transport ignores the abort signal. The gallery owns shared capture,
verification, and the privacy badge through its adapter, not this copy.

## Verification

Run `pnpm -F @katakit/demo-list-extraction test:ci`,
`pnpm -F @katakit/demo-list-extraction tsc`, `pnpm demos:copy-check list-extraction`, and
`pnpm gallery:copy-check` when gallery consumption changes. Controlled tests cover validation,
source integrity, replay, cancellation/late responses, terminal failures, and source/model
changes. They do not establish recognition accuracy, provider latency, or live permissions.

Manually dictate unrelated commitments, proposals, and decisions; stop and extract multiple
lists, inspect evidence and quote mode, edit/remove/undo/copy results, and navigate away during
admission or extraction. Repeat with denied microphone, unavailable inference, and exhausted
allowance. Verify that none silently starts or resumes inference; check the narrow layout and
capture cleanup. Report these browser/model checks separately from synthetic tests.
