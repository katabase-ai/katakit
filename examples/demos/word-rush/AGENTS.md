# Working on Word Rush

The [README](README.md) introduces the game. This guide covers running, embedding, and changing
an independent copy. Use Node.js 24+ and pnpm 11.9.0.

## Run independently

From a checkout, run `pnpm examples:copy demos/word-rush <destination>`, then `pnpm install`,
`pnpm build`, and `pnpm dev` inside the copy. Alternatively, download this directory with
`npx degit katabase-ai/katakit/examples/demos/word-rush word-rush` and install/run there.
The manifest uses registry dependencies; no gallery, sibling demo, or private package is needed.
Within the repository, run `pnpm build:pkgs` and `pnpm -F @katakit/demo-word-rush dev`.

Set the following in an ignored `.env.local` inside the standalone copy:

```text
VITE_WORD_RUSH_ENDPOINT=http://localhost:1234/v1/chat/completions
VITE_WORD_RUSH_MODEL=your-model-id
VITE_WORD_RUSH_DECISION_ENDPOINT=http://localhost:1234/api/alpha/decisions
VITE_WORD_RUSH_DECISION_MODEL=typesafe/jev-1.13
```

Both browser-accessible endpoints and models are required to start a round. The text endpoint
needs chat completions, strict JSON-schema output, and `max_completion_tokens`; the decision
endpoint needs text `state`, named `noul` questions, and typed `answers`. Optional
`VITE_WORD_RUSH_CREDENTIAL` and `VITE_WORD_RUSH_DECISION_CREDENTIAL` set separate bearer
credentials. Vite variables are visible in the browser: use them only locally. A public host
supplies its own admitted/proxied connection and keeps provider credentials server-side.
Production hosting must serve cross-origin isolation headers and the speech worker assets;
the Vite plugin provides local dev/preview setup. First use downloads the speech model and
requests microphone access. Audio stays on the device; finalized text goes to the judge.

## Organization and ownership

`src/main.tsx` is the standalone host and transport; `src/App.tsx` owns capture and its cleanup.
`src/WordRushDemo.tsx` renders the game and settings; `src/useRoundSetup.ts` owns cancellable
setup. `src/events.ts` defines typed facts and the live-emission schema; `src/wordRushPlugin.ts`
projects board content and records accepted commands. `src/createWordRushDemo.ts` owns one
visit's runtime, request queue, and round clock.
`src/wordRushModel.ts` owns the extraction/judging contract; `src/challenges.json` holds 200
stable challenges across 20 categories and `src/challenges.ts` selects them. Generic buttons and
selects and their CSS live in `src/ui/`; feature styles stay in `src/style.css`, while
`src/standalone.css` supplies global defaults only to `main.tsx`.
The standalone page header and passive microphone indicator are local presentation files;
the round button is shown below the page description while its setup and timing remain
owned by the game. Neither file connects to the gallery.
Behavior tests live in `tests/`. Keep model transport/admission in the host and gallery-only
adapters in `gallery/`, never in the copied demo.

The next challenge and duration are visit-level settings, not events. `roundStarted` records the
actual challenge, duration, round ID, and deadline, so replay reconstructs the chosen round.
Events also record finalized turns, accepted notes and
cursors, removals, and completion. Notes get stable IDs before recording. Provisional speech,
clock ticks, retry, connection, and cancellation are transient. Do not keep a second writable
authority for board content or regenerate IDs on replay. The plugin's `content$` is the sole
board projection; the factory combines it with transient status in a detached, read-only
`state$`. The log lasts for one visit; there is
no disk storage. `createWordRushDemo(existingEvents)` reconstructs from typed in-memory history
without restarting the clock or calling a model. An explicit `connect()` may resume recorded
pending speech; directly replacing a connection aborts its old request before doing so.
Decode any serialized history at the application boundary before passing it to the factory.

`App` supplies `connect({ signal })` to the feature view. It returns a `WordRushConnection`
with model ID, request-byte and output-token limits, `requestCompletion`, and required
`decisions: { model, maxQuestions, requestDecision }`. Respect both the visit signal and each
request signal. Admission only happens on **Start round**. The first model call extracts
candidates with exact transcript evidence; Jev judges each candidate using the challenge,
rule, examples, and original text. Probability `noul >= 0.5` qualifies an answer; the
threshold is not calibrated against real recordings. The demo records both accepted and
rejected judgments, but never raw provider responses. Removed labels stay excluded; accepted
results advance the cursor only after validation. Empty extraction advances without a decision
call. Requests run one at a time and retain pending speech. Only host-marked transient failures
retry automatically (twice); failed judging otherwise waits for **Retry judging**. Terminal
allowance failures survive new rounds. A new round aborts old work and clears its removal history.

The round starts only after microphone and judge setup succeed. Cancel setup must cancel both;
the clock starts only with an accepted round. Stop/expiry ends capture, drains final recognition,
and seals input with `flush`; pending judging can then finish. Unmount aborts requests, cancels
the clock, releases capture, and closes the runtime. A changed connection aborts active work
without silently resuming an old round. Do not assume core has a general stop/dispose API.

The gallery adapter leases the shared microphone, provides host inference and standard controls,
and keeps its catalogue/requirements in `gallery/`. Standalone embedding passes `connect` to
`App`; do not add gallery-specific providers to this demo. The gallery URL is
`/demos/word-rush`.

## Verification

Run `pnpm -F @katakit/demo-word-rush tsc`, `pnpm -F @katakit/demo-word-rush test:ci`,
`pnpm demos:copy-check word-rush`, and, for gallery integration changes,
`pnpm -F @katakit/gallery test:ci` and `pnpm gallery:copy-check`. Controlled tests cover
deadlines, untimed play, duplicates, queueing, retries, evidence, Jev refusals, bounded
batches, removals, cancellation, unmount, and final capture draining. They do not prove
recognition accuracy or model judgment quality.

Manually start/cancel setup, deny microphone permission, play a timed and an untimed round,
remove an answer while judging is pending, retry a failed batch, and navigate away during
setup/capture. Check stop/drain behavior, narrow layouts, and keyboard access in a browser
with real microphone/model connections. Report those checks separately from synthetic tests.
