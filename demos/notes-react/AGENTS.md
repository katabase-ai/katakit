# Structured notes example

`createNotesDemo.ts` owns one visit's runtime. `NotesDemo.tsx` renders it and starts model admission
once the microphone is listening. `App.tsx` owns standalone capture; the gallery supplies shared input.
`notesEvents.ts` defines finalized turns, accepted outlines, and clears. `notesPlugin.ts` derives
the outline, processed-turn cursor, and Markdown from that log. `notesModel.ts` owns the public
host contract, prompt, schema, and wire sizing.
`main.tsx` is the local standalone host. See `README.md` for embedding and verification.

Keep model transport and admission in the host. The example stays independently copyable with
its own manifest and no sibling demo or private website imports. Gallery adapters live in the gallery.

Record IDs and cursors with accepted outlines. Replay restores content without generating IDs or
calling a model. Keep connection, retry, and cancellation state outside the log. Bound only the
visible transcript; inference retains all finalized turns. Hosts place model controls and errors
through `renderModelControls`; the Markdown output contains only notes.

Retain all pending finalized turns across single-flight requests. Advance the cursor only after
validated output. Rewords replace existing note text; they never rewrite the transcript.
Clear and unmount must invalidate late results. Clearing an outline does not restore exhausted
allowance. New turns must not resume a paused failure or restart admission.
Stop/start reuses admission and the connection. Failed admission requires an explicit retry.

Verify standalone builds and runtime assets outside the workspace. Controlled tests
do not establish model quality, microphone compatibility, or provider latency.
