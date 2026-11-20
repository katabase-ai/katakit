# Brainstorming game

Collect spoken answers on a shared sticky-note board using one microphone. Choose from 200
pre-baked challenges in 20 categories. **Game settings** opens a modal for the category and
round length: 30s, 1min (the default), 2min, or unlimited play. **Apply** prepares a fresh round
when settings change; **Cancel** keeps the current board. Settings are locked during a round.
**Start round** begins the clock after the microphone is listening.
**End round** stops early. The challenge, judging rule, and sample answers stay hidden until the
round starts. **Next round** draws a different challenge and starts immediately. Remove mistaken answers with the button on each note. Typed answers
provide an alternative to speech. A browser reload starts a fresh game.

## Run

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build:pkgs
pnpm -F @katakit/demo-brainstorm build
pnpm -F @katakit/demo-brainstorm dev
```

The gallery also includes this example at `/demos/brainstorm`. Run `pnpm -F @katakit/gallery dev`
and open <http://127.0.0.1:4347/demos/brainstorm>.

Audio transcription runs locally with the existing transcription utility. Full judging starts
only through **Connect judge**; starting the microphone does not start inference. First use downloads
the speech model and asks for microphone access. The standalone app owns its microphone; the
gallery adapter leases the host's shared microphone. Capture and judging controls stay in the
demo; the gallery supplies its header, privacy badge, and shared setup footer.

## Answer judging

Full judging uses a host-supplied model connection. The prompt includes the challenge, judging
rule, shared rules, existing answers, removed answers, and new finalized transcript. Validated
responses supply short answer labels and verbatim transcript evidence. The five sample answers
are examples, not a whitelist for the model.

Without a model connection, the demo explicitly uses **Sample practice**. Only the five examples
displayed below the board count. This lets the round, microphone, notes, and corrections be tried
without a paid service. It does not demonstrate open-ended judging.

For full standalone judging, set these values in an ignored `.env.local` in this directory:

```text
VITE_BRAINSTORM_ENDPOINT=http://localhost:1234/v1/chat/completions
VITE_BRAINSTORM_MODEL=your-model-id
```

The endpoint must allow browser requests and support chat completions with strict JSON-schema
responses and `max_completion_tokens`. Optional `VITE_BRAINSTORM_CREDENTIAL` supplies a bearer
credential. These Vite values are visible in the browser: use this configuration locally.
Public hosts provide their own proxy and keep credentials on the server.

The gallery uses its existing Configure models screen in developer mode or a host-supplied
`connectModel` in public mode. Public preview never uses saved developer keys. The lazy
`brainstormGalleryDemo` export needs no private service imports.

Standalone embedders pass `connect` to `App`. It receives a visit-lifetime `AbortSignal` and returns
a `BrainstormConnection`: model ID, request-byte limit, output-token allowance, and
`requestCompletion({ body, signal })`. Respect both signals. Admission happens only through **Connect judge**. Admission and judging failures require explicit retries.
`BrainstormRequestError` preserves host terminal/restart policies; terminal allowance failures
survive round resets.

## State and input lifecycle

`createBrainstormDemo` derives board content from a Katakit event log. Events record challenge
selection, round start/deadline, finalized text, accepted notes/cursors, removals, and completion.
Clocks, admission, provisional text, requests, and failures remain transient. History lasts for
one visit. Notes receive stable IDs when accepted.

Only finalized speech during a round is queued for judging. At expiry the clock stops, and the
host stops and drains capture. Final recognition results are accepted until `flush` seals input.
Pending judging can finish afterward; the board shows progress. Stopping the shared microphone
also ends the round. Typed submissions after the deadline are rejected. Untimed rounds end
explicitly.

Requests run one at a time and retain pending input in order. Invalid results pause without
advancing the cursor. **Retry judging** processes the retained text. Removed labels prevent late
results from restoring deleted notes. A new round clears that removal history and aborts old
requests. Closing or navigating away aborts requests, cancels the clock, and completes state.

## Library and verification

`src/challenges.json` contains the drafted library: 20 categories, 200 stable challenge IDs,
per-challenge rules, and 1,000 illustrative examples. `src/challenges.ts` supplies category
filtering and random selection without immediately repeating the current challenge.

```sh
pnpm -F @katakit/demo-brainstorm tsc
pnpm -F @katakit/demo-brainstorm test:ci
pnpm -F @katakit/gallery test:ci
```

Controlled tests cover deadlines, untimed play, duplicates, queueing, retries, evidence validation,
removals, cancellation, unmount, and final capture draining. Real recognition and model quality
need browser/model playtesting. Production hosts must serve the transcription utility's worker
assets and cross-origin isolation headers; the Vite plugin handles local dev and preview.

To prepare a standalone copy, run `pnpm examples:copy demos/brainstorm-react /tmp/my-brainstorm`,
then install and build inside that new directory. The manifest uses registry library versions.
`pnpm demos:copy-check brainstorm-react` verifies a copy against freshly packed local libraries.
No sibling demo imports are used.

Changing gallery inference settings or preview mode aborts pending judging and ends the round,
keeping accepted notes on the board. The new connection requires an explicit **Connect judge**.
