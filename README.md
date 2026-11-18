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
