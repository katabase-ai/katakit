# Gallery consistency review evidence

Screenshots are captured from the actual Katakit gallery, not mockups. This branch contains review artifacts only and is not intended to merge into main.

## PR 1: instructions

- Baseline: `845b1da` (#83); proposed: `db12872`.
- Source worktree: `/private/tmp/katakit-gallery-consistency`.
- URL: `http://127.0.0.1:59926/demos/{transcription,bingo,notes,color-clash}`.
- Production/public build, dark theme, default desktop viewport 1280 × 720; full-page captures can be taller. Mobile Notes uses 390 × 844.
- Empty initial state, no microphone or model requests. The initial Bingo card is the default Meeting phrases card. Shuffle and word-list changes draw a new card.
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

## PR 3: content lifetime

- Baseline: `b6ef0fb` (PR #85); proposed source: `4f6957a`, carried into `2b54ea3` after the parent recovery fixes. Those fixes affect blocked/stopping states, not the shown states.
- Actual public gallery, dark theme, 1280 × 720 viewport with full-page captures; mobile Notes is 390 × 844.
- Controlled transcriber supplies: “We will plan the launch on Friday. Quick question: who will review the plan?” The review host implements the public `connectModel` contract and returns “Plan the launch on Friday.” No microphone, model download, or external service request occurs.
- Notes is shown with the same completed input and accepted outline on both sides. Paused and cleared states are separate captures. The outline clears while capture continues; earlier input remains local and may be sent as context by subsequent requests.
- Other pairs show the default initial view with the model retained from the prior visit.
- Timed cancellation, late-result rejection, fresh visits, and retained matching evidence are covered by tests. Screenshots show messaging and resulting state.

## PR 4: keyboard focus and state feedback

- Baseline: PR #86 (`4f6957a` presentation, carried unchanged into `2b54ea3`); proposed: `2cef040`.
- Actual public gallery, dark theme, 1280 × 720 desktop / 390 × 844 mobile, full-page captures. Full-page mobile captures may show the fixed footer at the initial viewport boundary; the page itself scrolls normally. Notes has no horizontal overflow at 390px.
- `04-navigation-{before,after}.jpg`: keyboard Enter on the Structured notes navigation link. Before focus remains on the navigation link; after it lands on H1. The controlled host connection is available in both captures.
- `04-cancel-focus-{before,after}.jpg`: keyboard Play → Cancel download. Before focus falls to BODY; after it remains on the Play button. Same controlled download fixture.
- `03-notes-paused-after.jpg` is the parent baseline for `04-notes-paused-after.jpg`; both use the same synthetic transcript/outline. The proposed view explicitly reports Notes paused.
- `04-round-result-after.jpg`: real 20-second game round with controlled speech input, score 0, capture stopped at the end, result status visible. Automated tests additionally cover interruption.
- `04-public-notes-after.jpg` and `04-public-notes-mobile-after.jpg` use the ordinary production host with **no review adapters**: Start notes remains disabled with an accessible explanation, and keyboard navigation focuses the title.
- Native details help was opened with Enter; privacy opens from keyboard focus and dismisses with Escape. No microphone permission was granted and no paid/provider request was made. Screen-reader and physical-microphone verification remain outside this evidence.
