# Structured notes example

The [README](README.md) introduces the feature. Use Node.js 24+ and pnpm 11.9.0.
For an independent copy, run `pnpm examples:copy demos/notes <destination>` from an installed
checkout, then `pnpm install`, `pnpm build`, and `pnpm dev` in the copy. Alternatively run
`npx degit katabase-ai/katakit/examples/demos/notes structured-notes`, then install and run.
Within the checkout, run `pnpm build:pkgs` and `pnpm -F @katakit/demo-notes dev`.
Keep the whole directory: the manifest includes `react-markdown`, `ts-pattern`, and `es-toolkit`,
and `pnpm-workspace.yaml` permits the `esbuild` install script.

Configure `VITE_NOTES_ENDPOINT` and `VITE_NOTES_CREDENTIAL` in an ignored `.env.local` for
standalone inference. The endpoint must support browser CORS and OpenAI-compatible chat
completions; the standalone host selects `z-ai/glm-5.3`. Vite variables are visible in the
browser: use them only locally. Public hosts should use a proxy with anonymous admission.
On first capture, the recognizer downloads its model and requests microphone permission.
The Vite transcription-assets plugin serves worker/WASM assets and local isolation headers.
Production must supply document COOP `same-origin`, document/worker COEP `require-corp`,
and the assets. Audio stays on-device; finalized text goes to the configured model.

## Organization and ownership

`createNotesDemo.ts` owns one visit's runtime. `NotesDemo.tsx` renders it. `useNotesConnection.ts`
owns admission while the host is listening, retry, and visit cancellation.
`App.tsx` owns standalone capture through `useMicrophoneTranscriber`; the gallery supplies shared input.
`notesEvents.ts` defines finalized turns, accepted outlines, and clears. `notesPlugin.ts` derives
the outline, processed-turn cursor, and Markdown from that log. `applyNotesResult.ts` validates a
whole model result and copies the accepted outline without mutating recorded events. `notesModel.ts` owns the public
host contract, prompt, schema, and wire sizing.
`src/ui/TranscriptTurns.tsx` renders numbered turns from transcript streams; its own
`transcript-turns.css` styles the widget. The feature's `style.css` owns the surrounding
notes/transcript layout.
`TranscriptPreview.tsx` and `createTranscriptPreview.ts` are kept identical to the bingo example's
copies. `TranscriptPreview.tsx` renders live transcript lines, newest first, lighter with age by position
(no per-line animation: animated lines in the sticky panel were painted at stale positions).
`createTranscriptPreview.ts` owns their twenty-second display lifetime. Keep display timing outside
the event log; finalization keeps the draft line's identity.
`main.tsx` is the local standalone transport and imports the feature CSS. Tests live in
`tests/`. The feature CSS stays scoped so embedding does not import standalone defaults.

Keep model transport and admission in the host. The host returns the chat-completions response
body; `notesModel.ts` reads and validates it so every host reports the same failures.
The example stays independently copyable with
its own manifest and no sibling demo or private website imports. Gallery adapters live in the gallery.

Record IDs and cursors with accepted outlines. Replay restores content without generating IDs or
calling a model. Keep connection, retry, and cancellation state outside the log. Bound only the
visible transcript by age; inference retains all finalized turns. Hosts place model controls and errors
through `renderModelControls`; the Markdown output contains only notes.

Retain all pending finalized turns across single-flight requests. Advance the cursor only after
validated output. Rewords replace existing note text; they never rewrite the transcript.
Clear and unmount must invalidate late results. Clearing an outline does not restore exhausted
allowance. New turns must not resume a paused failure or restart admission.
Inference follows capture: there is no separate notes control. `listening` admits a connection;
stopping/restarting capture reuses it. A changed connect function aborts admission and remote work
without clearing content, then reconnects if still listening. Failed admission and failed requests retry
twice on their own; a new listening start retries once more. Never fail a whole response for a
misused note ID: apply the rest (see `applyNotesResult.ts`).

## Embedding and model admission

Copy the example and render `<App connect={connect} />` with a memoized callback returning
`{ model, maxBodyBytes, maxOutputTokens, requestCompletion({ body, signal }) }`.
Respect the visit signal from `connect({ signal })` and the request's signal; return the parsed
chat-completions response. The application parses and validates that response. `connect` runs
when listening begins, not during page load or microphone permission. A changed callback aborts
admission and inference without clearing content, then reconnects if still listening.

A failed admission or request retries twice on its own. Pausing and resuming listening gives an
exhausted transient failure another attempt; a terminal allowance failure must not be retried
or cleared. `NotesRequestError` policies can set retry limit and delay, restart admission, or
mark failures terminal. Only context-limit failures are clearable. Hosts may receive
`reportFailure` for transport/validation diagnostics; never log transcript or generated text.
The example reports malformed, truncated, unfinished, non-JSON, invalid-schema, and invalid
target results with policy codes. Unknown rewords are dropped, misplaced details join siblings,
and additions under unknown IDs become top-level notes rather than rejecting an entire result.
A validated result may legitimately add no visible notes.

`createNotesDemo({ initialEvents })` restores an ordered history from
`runtime.events$.getAll()`, including metadata. JSON timestamps are converted back to `Date`
after validation. Accepted outlines include stable IDs and the processed-turn cursor;
`notesCleared` records the cursor without rerunning inference. A connected session can process
turns remaining after the recorded cursor. The history remains in memory for one visit.
Only live lines stay in the visible transcript for twenty seconds; all finalized turns remain
available to inference and replay. Requests include the outline, pending turns, and up to six
preceding context turns. Oversized input pauses instead of dropping content. Standalone unmount
currently flushes and closes the runtime before the microphone hook finishes asynchronous
disposal; final recognition may not be delivered. The TODO in `App.tsx` tracks coordinating
stop/drain, flush, and close while aborting model work promptly. The gallery can retain its ready
recognizer across routes. Pending microphone permission and late grants must be cancelled.

The gallery adapter provides shared capture, host admission, errors, model controls, and usage
meter via `renderModelControls`; it stays in `gallery/`. A public gallery without inference
still demonstrates transcription. Keep host credentials and provider transport out of the
copyable feature and out of the Markdown output.

## Verification

Run `pnpm -F @katakit/demo-notes test:ci`, `pnpm -F @katakit/demo-notes tsc`,
`pnpm demos:copy-check notes`, and, when gallery consumption changes,
`pnpm gallery:copy-check`. Verify standalone builds and assets outside the workspace.
Controlled tests do not establish recognition quality, spelling correction, model latency,
or microphone compatibility.

Manually capture speech, correct a previously misheard name, pause/resume listening,
exercise admission and request failures, clear notes, and leave while a request or microphone
permission is pending. Check that late results cannot revive cleared notes, old transcript
does not flash on replay, and capture stops on exit. Report browser/model observations
separately from synthetic tests.
