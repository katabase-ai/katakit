# Structured notes example

`createNotesDemo.ts` owns one visit's runtime. `NotesDemo.tsx` renders it. `useNotesConnection.ts`
owns admission while the host is listening, retry, and visit cancellation.
`App.tsx` owns standalone capture through `useMicrophoneTranscriber`; the gallery supplies shared input.
`notesEvents.ts` defines finalized turns, accepted outlines, and clears. `notesPlugin.ts` derives
the outline, processed-turn cursor, and Markdown from that log. `applyNotesResult.ts` validates a
whole model result and copies the accepted outline without mutating recorded events. `notesModel.ts` owns the public
host contract, prompt, schema, and wire sizing.
`TranscriptPreview.tsx` and `createTranscriptPreview.ts` are kept identical to the bingo example's
copies. `TranscriptPreview.tsx` renders live transcript lines, newest first, lighter with age by position
(no per-line animation: animated lines in the sticky panel were painted at stale positions).
`createTranscriptPreview.ts` owns their twenty-second display lifetime. Keep display timing outside
the event log; finalization keeps the draft line's identity.
`main.tsx` is the local standalone host. See `README.md` for embedding and verification.

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

Verify standalone builds and runtime assets outside the workspace. Controlled tests
do not establish model quality, microphone compatibility, or provider latency.
