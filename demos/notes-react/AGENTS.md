# Structured notes example

`createNotesDemo.ts` owns one visit's runtime. `NotesDemo.tsx` renders it. `useNotesConnection.ts`
owns explicit Start notes/Pause notes, admission, retry, and visit cancellation.
`App.tsx` owns standalone capture through `useMicrophoneTranscriber`; the gallery supplies shared input.
`notesEvents.ts` defines finalized turns, accepted outlines, and clears. `notesPlugin.ts` derives
the outline, processed-turn cursor, and Markdown from that log. `applyNotesResult.ts` validates a
whole model result and copies the accepted outline without mutating recorded events. `notesModel.ts` owns the public
host contract, prompt, schema, and wire sizing.
`TranscriptPreview.tsx` renders live words with CSS fades. `createTranscriptPreview.ts` owns their
twenty-second display lifetime. Keep display timing outside the event log; finalization preserves word age.
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
Starting capture never starts inference. Start notes admits a connection; stopping/restarting capture
reuses it. Pause notes or a changed connect function aborts admission and remote work without
clearing content. Only an explicit Start notes resumes. Failed admission requires an explicit retry.

Verify standalone builds and runtime assets outside the workspace. Controlled tests
do not establish model quality, microphone compatibility, or provider latency.
