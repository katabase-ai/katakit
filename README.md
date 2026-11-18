# Gallery consistency review evidence

Screenshots are captured from the actual Katakit gallery, not mockups. This branch contains review artifacts only and is not intended to merge into main.

## PR 1: instructions

- Baseline: `845b1da` (#83); proposed: `db12872`.
- Source worktree: `/private/tmp/katakit-gallery-consistency`.
- URL: `http://127.0.0.1:59926/demos/{transcription,bingo,notes,color-clash}`.
- Production/public build, dark theme, default desktop viewport 1280 × 720; full-page captures can be taller. Mobile Notes uses 390 × 844.
- Empty initial state, no microphone or model requests. The Bingo card is randomly drawn by the app, so card phrases differ across visits; those differences are not part of the change.
- `01-*-before.jpg` is the baseline; `01-*-after.jpg` is the proposed version.

Later evidence with controlled services will be identified separately. Controlled services establish UI/lifecycle behavior, not live microphone compatibility or provider performance.

## PR 2: capture and recovery

- Baseline: `db12872` (#84); proposed: `dbea22f`.
- Actual gallery components in a public production build with a review-only controlled transcriber adapter. Dark theme, 540 × 900 viewport; capture is full-page.
- Routes: `/demos/transcription?review=permission` and `?review=download` on the same local server.
- Permission fixture reports a typed permission denial. Download fixture holds at 25% until Cancel disposes it. Neither opens a microphone or downloads a model.
- `02-permission-{before,after}.jpg` and `02-download-{before,after}.jpg` compare the parent and proposed version. Expanded help is captured separately.
- `02-cancel-sequence.mp4` stitches two real app screenshots (downloading → cancelled), held for 2 seconds each; it is a state sequence, not a real-time recording. Duration 4 seconds, 540 × 900, verified with ffprobe.
- Timed lifecycle behavior is verified by automated tests; still images do not prove cancellation timing.
