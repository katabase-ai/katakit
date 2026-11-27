# List extraction example

The copyable feature owns its rules, extraction schema/prompt, source validation, and view.
`extractionPlugin.ts` projects durable content from the event log. `createListExtractionDemo.ts`
owns one visit's cancellable on-demand admission/request and transcript resources.
`ListExtractionDemo.tsx` binds runtime observables with React-RxJS. `App.tsx` owns standalone
capture; the gallery adapter lives in the gallery and supplies shared capture/model controls.

Do not start inference on capture, new turns, replay, or rule edits. Preserve the last accepted
results on failure. Validate every source before recording any returned items. Quotes must be
contiguous exact transcript excerpts. Rules, accepted IDs, evidence, edits, and removal/undo
belong in the log; requests, cancellation, form disclosure, selection, and clipboard state do not.

Keep terminal allowance failures through clear and sample operations. Source changes and unmount
abort model work immediately; the input owner drains capture before runtime close. Late results
must be discarded, including from a host that ignores AbortSignal. Do not add upload controls to
the dictation-only version. The built-in sample is a labeled fixture, never a fallback for real
model processing or a replacement for existing user speech.

Run focused tests, gallery integration tests, and independent feature/gallery copy checks.
Distinguish synthetic speech/model evidence from real microphone/provider verification.
