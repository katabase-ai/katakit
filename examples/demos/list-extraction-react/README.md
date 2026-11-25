# List extraction

Dictate locally, choose one or more lists, then select **Extract lists** to send the complete
finalized transcript to a host-supplied model. Audio stays on-device. This version supports
dictation only; recording upload is deferred. Extraction is on demand, not progressive.

## Run or copy

Use Node.js 24+ and pnpm 11.9.0. From an installed Katakit checkout:

```sh
pnpm build:pkgs
pnpm -F @katakit/demo-list-extraction dev
# Or prepare an independent application:
pnpm examples:copy demos/list-extraction-react /tmp/my-list-extraction
cd /tmp/my-list-extraction
pnpm install
pnpm build
pnpm dev
```

You can also copy the public example directly, without a checkout:

```sh
npx degit katabase-ai/katakit/examples/demos/list-extraction-react list-extraction
cd list-extraction
pnpm install
pnpm dev
```

The gallery's **Run locally** panel pins this command to the host's source revision when supplied.
The copy contains its own source, runtime configuration, and registry dependencies.
No gallery, sibling example, private package, or outside source alias is required.

This migration requires core's built-in `EventLogPlugin` and the log-backed `eventLog` API in
`@katakit/transcript-ingestion`. The currently pinned npm releases (`0.1.0`) do not yet provide
these APIs: until they are released and the registry pins are updated, use the checkout or the contributor copy check with freshly
packed libraries. A registry-only copy cannot yet build this revision.

**Try sample** loads an explicitly labeled transcript fixture and preset results without a
microphone, admission, or model request. Custom instructions have no fixture results. The sample
does not overwrite real dictation. **Use my own dictation** beside the sample notice clears the
fixture and restores capture controls without starting the microphone or inference. For real speech,
**New dictation** confirms before clearing the visible session; the microphone remains off until
**Start listening**. Content is in memory and lost on reload.

For the local standalone host, set `VITE_EXTRACTION_ENDPOINT` and `VITE_EXTRACTION_CREDENTIAL`
in an ignored `.env.local`. The endpoint must support browser CORS, chat completions, and JSON
schema output. The default model is `z-ai/glm-5.3`. These Vite values are visible in the browser;
use personal credentials only in this local host. Public hosts supply their own `connect` callback
for admission and transport. With no connection, local dictation and the sample remain available.

Vite installs transcription assets and local COOP/COEP headers through
`transcriptionAssetsPlugin({ isolate: true })`. Production must serve HTTPS, document COOP
`same-origin`, document/worker COEP `require-corp`, and the generated `transcription-assets/`.
English speech models download on first use. Source timestamps are recognition estimates; exact
quotes are verified transcript excerpts, not a claim of perfect recognition or audio alignment.

List setup starts as a compact preset row. **Options** contains the preset explanation, name,
wording, instructions, and list removal. When dictation starts, setup collapses to a list-name
summary; **Edit lists** reopens it without starting inference. **Extract lists** lives beside the
output heading, with a transcript-sharing notice below. **Copy** appears only after results exist
and copies Markdown.

The results and transcript sit side by side when there is room for both columns. The transcript shows numbered turns,
newest first, with estimated timestamps and live provisional text. It scrolls independently while
lists grow; on narrow screens it stacks below the lists and follows normal page scrolling.

## Behavior and ownership

`createListExtractionDemo` owns a visit's Katakit runtime. It composes transcript ingestion, a
validated event log, and the local extraction plugin. Rules, finalized segments and turns, accepted results,
text edits, visibility changes, and session clears are logged. Projections derive content and
Markdown; the log is the sole authority. IDs and evidence are recorded with accepted items.
The factory validates all `initialEvents` with `ExtractionEventSchema` before starting either
runtime. Commands validate live writes before core's built-in `EventLogPlugin` adds its sequence
and timestamp metadata. Transcript ingestion reads that same log, including sample turns and session clears;
its live notifications are not a second source of transcript history.

For an in-memory restore, take `runtime.events$.getAll()` and pass that snapshot to
`createListExtractionDemo({ initialEvents })`. A JSON round trip is supported. Replay restores
rules, pending finalized segments, completed turns, accepted IDs, evidence, edits, and visibility
without calling a model, allocating replacement IDs, scheduling silence timers, or appending
events. Provisional recognition text and request/error state are transient and start empty.
There is no automatic storage or reload persistence.

Native log snapshots retain their metadata. JSON snapshots restore ISO timestamp strings as
Dates without changing their values. Legacy metadata-free snapshots receive their array index
as sequence and the Unix epoch as timestamp, preserving all recorded content and source IDs;
this deterministic import does not invent historical wall-clock times.

Recorded source/segment IDs suppress retransmission after restore. A pending turn continues
with its recorded ID when fresh speech arrives; explicit flush/extraction can finalize it.
Legacy turn-only history remains readable, but cannot deduplicate segment IDs it never recorded.
Duplicate turn IDs project once. **New dictation** discards pending input and records one clear
event, retaining list rules while clearing results and resetting transcript deduplication.

Admission, request cancellation, and error state are transient. Only an explicit **Extract lists**
calls `connect({ signal })` and `requestCompletion({ body, signal })`. The host supplies `model`,
`maxBodyBytes`, `maxOutputTokens`, the parsed chat-completions response, and optional failure
diagnostics through the example's `ExtractionConnection` interface. Providers and credentials do
not belong in the plugin. Terminal allowance failures survive clear, sample refresh, and rule
changes. Source changes explicitly invalidate the previous connection. Failures require another
click; the example never retries or resumes on new speech automatically.

The request includes all finalized turns and every list rule. An oversized body fails without
dropping transcript. Invalid, unfinished, truncated, or incorrectly sourced output is rejected
atomically, preserving the last accepted results. Every source must reference a known turn and
an exact contiguous excerpt. Quote mode displays these verified excerpts. Cleaned-up items retain
the same evidence. Owners and dates are requested only when supported; relative dates remain
relative. Correctness of category judgments still depends on the model and human review.

Equivalent returned items merge within a list while retaining distinct source occurrences.
Rules apply independently, so the same speech can appear in several lists. Editing a result never
edits its transcript. Removal is undoable. Copy Markdown includes the visible lists and timestamped
excerpts. Rule or transcript changes leave old results visible with a stale notice; a deliberate
new extraction replaces the visible results. Earlier events remain in the visit history.

Changing rules, reviewing an item, clearing, cancelling, or unmounting invalidates pending model
work and discards late responses. Capture start cancels extraction. The input owner stops/drains
capture before closing the runtime; `close` cancels admission/model work, flushes live pending
input, closes ingestion, and completes its projections and subscriptions. Closing a runtime that
only hydrated history does not append a turn; explicit `flush` can finalize that pending history
before close. Repeated close and post-close input/flush are inert. This is application-owned
cleanup, not a generic core disposal API.

## Gallery integration

The gallery registers `listExtractionGalleryDemo` at `/demos/list-extraction`. Its adapter supplies
shared capture, host inference, verification, and the shared Cloud-assisted privacy badge.
It declares `microphone`, `localTranscription`, and `remoteModel` capabilities. The standalone
`App` owns capture through `useMicrophoneTranscriber`; neither the view nor the runtime imports
gallery modules. Hosts with explicit demo selections must adopt the named catalogue entry.

## Verification

```sh
pnpm -F @katakit/demo-list-extraction test:ci
pnpm -F @katakit/demo-list-extraction tsc
pnpm demos:copy-check list-extraction-react
pnpm demos:copy-check gallery
```

Controlled tests cover validation, source integrity, JSON replay equivalence, pending-turn
continuation, duplicate segments/turns, clear and reuse of segment IDs, cancellation/late responses,
terminal failures, and source/model changes. Copy checks install/build/test outside the checkout
and verify runtime assets and isolation headers. They do not establish recognition accuracy,
model judgment quality, provider latency, or real microphone permissions.

For manual acceptance, dictate unrelated speech among commitments, proposals, and decisions.
Stop, extract with several presets, check source excerpts and quote mode, edit/remove/undo/copy,
and navigate away while connecting or extracting. Repeat with a denied microphone, unavailable
inference, and an exhausted allowance. Verify that none silently start or resume model processing.
