# Live notes example

`createNotesDemo.ts` owns one visit's runtime. `NotesDemo.tsx` renders it and admits model use
only after Start notes. `App.tsx` owns standalone capture; the gallery supplies shared input.
`notesPlugin.ts` owns the outline and
processed-turn cursor. `notesModel.ts` owns the public host contract, prompt, schema, and wire sizing.
`main.tsx` is the local standalone host. See `README.md` for embedding and verification.

Keep model transport and admission in the host. The example stays independently copyable with
its own manifest and no sibling demo or private website imports. Gallery adapters live in the gallery.

Retain all pending finalized turns across single-flight requests. Advance the cursor only after
validated output. Rewords replace existing note text; they never rewrite the transcript.
Clear and unmount must invalidate late results. Clearing an outline does not restore exhausted
allowance. New turns must not resume a paused failure or restart admission.

Verify standalone builds and runtime assets outside the workspace. Controlled tests
do not establish model quality, microphone compatibility, or provider latency.
