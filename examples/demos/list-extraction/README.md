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
pnpm examples:copy demos/list-extraction /tmp/my-list-extraction
cd /tmp/my-list-extraction
pnpm install
pnpm build
pnpm dev
```

You can also copy the public example directly, without a checkout:

```sh
npx degit katabase-ai/katakit/examples/demos/list-extraction list-extraction
cd list-extraction
pnpm install
pnpm dev
```

The gallery's **Run locally** panel pins this command to the host's source revision when supplied.
The copy contains its own source, runtime configuration, and registry dependencies.
No gallery, sibling example, private package, or outside source alias is required.

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
validated event log, and the local extraction plugin. Rules, finalized turns, accepted results,
text edits, visibility changes, and session clears are logged. Projections derive content and
Markdown; the log is the sole authority. IDs and evidence are recorded with accepted items.
Pass the recorded history from `runtime.events$.getAll()` as `initialEvents`, including each record's `meta`. The demo validates payloads and metadata and restores timestamps from JSON.
Replay restores content without calling a model, generating IDs, or restarting capture.

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
capture before closing the runtime; `close` cancels admission/model work, flushes/closes ingestion,
and completes its projections and subscriptions. It does not claim a generic core disposal API.

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
pnpm demos:copy-check list-extraction
pnpm demos:copy-check gallery
```

Controlled tests cover validation, source integrity, replay, cancellation/late responses,
terminal failures, and source/model changes. Copy checks install/build/test outside the checkout
and verify runtime assets and isolation headers. They do not establish recognition accuracy,
model judgment quality, provider latency, or real microphone permissions.

For manual acceptance, dictate unrelated speech among commitments, proposals, and decisions.
Stop, extract with several presets, check source excerpts and quote mode, edit/remove/undo/copy,
and navigate away while connecting or extracting. Repeat with a denied microphone, unavailable
inference, and an exhausted allowance. Verify that none silently start or resume model processing.
