# Brainstorming game

Collect spoken answers on a shared sticky-note board using one microphone. Choose from 200
pre-baked challenges in 20 categories. **Game settings** opens a modal for the category and
round length: 30s, 1min (the default), 2min, or unlimited play. **Apply** prepares a fresh round
when settings change; **Cancel** keeps the current board. Settings are locked during a round.
**Start round** prepares the microphone and connects the required judge. The challenge
stays hidden and the clock stays stopped until both are ready. **Cancel setup** cancels pending
setup without starting a round or spending round time. Failed setup can be retried with **Start round**.
**End round** stops early. The challenge and judging rule stay hidden until the
round starts. **Next round** draws a different challenge and prepares capture before starting.
Remove mistaken answers with the button on each note. Rounds use one shared microphone and
require a judging connection. A browser reload starts a fresh game.

The prompt and judging rule share a compact card with the remaining time and answer count.
The board has one empty-state hint and expands on taller desktop screens to leave more room for notes.

The Transcript panel sits to the right of the game, with numbered entries newest first and muted
interim speech above them. It scrolls independently and stacks below the game on narrow screens.
It shows the round's original spoken input, including words that do not qualify as
answers. Ending a round keeps the transcript; preparing a fresh round clears it with the board.

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

Audio transcription runs locally with the existing transcription utility. Only an explicit
**Start round** admits a model connection. First use downloads the speech model and asks for
microphone access. The standalone app owns cancellable capture; the gallery adapter leases the
host's shared microphone. The gallery shows one Start round / Cancel setup / End round action
in its standard header controls. Its shared Settings explains missing inference configuration.
There is no separate microphone Start or judge-connect action.

## Answer judging

Judging uses two stages on a host-supplied connection. A text model extracts candidate labels
and exact transcript evidence without filtering by category. It includes tentative suggestions
and question-phrased answers, and uses existing/removed labels to normalize genuine synonyms
and plurals. Distinct subtypes stay separate. Jev then evaluates each explicit candidate against
the challenge, judging rule, shared rules, illustrative examples, and original transcript.
The examples are not a whitelist. Audio stays on the device.

Jev returns a yes/no probability (`noul`) for every candidate. This experiment accepts values
at or above 0.5; that initial cutoff has not been calibrated against real game recordings.
Code filters duplicate/removed labels and creates the sticky notes. Both accepted and rejected
candidate probabilities are retained in the round's event log and `state$.value.judgments` for
debugging; they clear with the next round. No raw provider response is logged.

Each nonempty extraction batch needs one text-generation call and at least one decision call.
Decision batches respect the connection's question and byte limits. Both stages share the host's
allowance and rate limits. Only host-marked transient failures retry automatically, at most twice,
respecting the host's delay. Cancellation clears the retry timer. Missing, refused, or malformed
decisions pause the batch for **Retry judging**, without treating them as negative answers or
advancing the transcript cursor. Valid empty extraction still advances without a Jev call.

For standalone judging, set these values in an ignored `.env.local` in this directory:

```text
VITE_BRAINSTORM_ENDPOINT=http://localhost:1234/v1/chat/completions
VITE_BRAINSTORM_MODEL=your-model-id
VITE_BRAINSTORM_DECISION_ENDPOINT=http://localhost:1234/api/alpha/decisions
VITE_BRAINSTORM_DECISION_MODEL=typesafe/jev-1.13
```

Both endpoints must allow browser requests. The text endpoint must support chat completions
with strict JSON-schema responses and `max_completion_tokens`; the decision endpoint must support
text `state`, named `noul` questions, and typed `answers`. Optional `VITE_BRAINSTORM_CREDENTIAL`
and `VITE_BRAINSTORM_DECISION_CREDENTIAL` supply separate bearer credentials for their respective
endpoints. Credentials are never copied between endpoints. These Vite values are visible in the
browser: use this configuration locally. Public hosts provide their own proxy and keep provider
credentials on the server. Both endpoints/models are required before Start is available.

The gallery uses its existing Configure models screen in developer mode or a host-supplied
`connectModel` in public mode. Managed previews use the existing ProtoZoa proxy's pinned
`typesafe/jev-1.13` decision route with the same verified session as chat. Developer connections
to OpenRouter use that pinned Jev model with the configured OpenRouter key; the text model setting
selects the candidate extractor. Custom chat endpoints need an embedding host that also supplies
the decision transport. Public preview never uses saved developer keys. The lazy
`brainstormGalleryDemo` export needs no private service imports.

Standalone embedders pass `connect` to `App`. It receives a visit-lifetime `AbortSignal` and returns
a `BrainstormConnection`: model ID, request-byte limit, output-token allowance, and
`requestCompletion({ body, signal })`, and required `decisions: { model, maxQuestions,
requestDecision({ body, signal }) }`. Respect both signals in each transport. Admission happens during **Start round**.
Admission failures require another Start; transient judging failures use **Retry judging**.
`BrainstormRequestError` preserves host terminal/restart policies; terminal allowance failures
survive round resets.

## State and input lifecycle

`createBrainstormDemo` derives board content from a Katakit event log. Events record challenge
selection, round start/deadline, finalized text, accepted notes/cursors, removals, and completion.
Clocks, admission, provisional text, requests, and failures remain transient. The snapshot subject
is a delivery cache of the event projection plus that transient state, not a second content store.
History lasts for one visit. Notes and rounds receive stable IDs only in live commands.

### Restore an in-memory history

An embedding host can collect `BrainstormEvent` values from `runtime.events$` (which replays
the complete history) and pass their JSON round-trip to
`createBrainstormDemo({ initialEvents })`. The factory validates both event shapes and history
ordering before constructing the runtime: known challenges, finite durations/times, unique
recorded IDs, valid phase transitions, forward-only cursors within the transcript, and note
evidence backed by recorded qualifying judgments. Invalid history throws; it is not partially loaded.

Replay preserves recorded round/note IDs, transcript, judgments, removals, and cursor. It does not
allocate IDs, append events, call a model, start capture, or restart a clock. Segment-delivery
deduplication is reconstructed from all `heard` events, including earlier rounds. Hosts must use
fresh source/segment IDs for genuinely new speech. Duplicate final delivery remains a no-op after
restoration and after clearing the board; removed labels suppress repeated answers within a round.

A restored running/finishing round, or a finished round with unjudged text, has transient
`interrupted: true`. Its recorded phase remains intact. Connecting a host or retrying does not
process this history until an explicit `recover()` command. **Close interrupted round** invokes
that command: it seals the old input, records completion if necessary, and permits judging only
the pending transcript suffix with the connected host. Settings stay locked until the round is
closed or cleared; they cannot silently discard pending input. Recovery never resumes capture or
the old clock.
If disconnected, the suffix waits for a later explicit host connection. Already accepted answers
are not judged again. `clear()` instead aborts pending work and appends a `configured` event,
resetting the board/transcript/removals/cursor while keeping the selected challenge and duration.
Clear retains the log; it is not a storage erasure operation. Both paths allow a fresh round.

The standalone app and gallery still create fresh visits; neither automatically stores or restores
history. Persistence remains the embedding application's choice. `remaining` is display state
computed from the recorded deadline/end time and the current clock, not replayable content.

Only finalized speech during a round is queued for judging. At expiry the clock stops, and the
host stops and drains capture. Final recognition results are accepted until `flush` seals input.
Pending judging can finish afterward; the board shows progress. Stopping the shared microphone
also ends the round. Untimed rounds end
explicitly.

Requests run one at a time and retain pending input in order. Invalid results pause without
advancing the cursor. **Retry judging** extracts and judges the retained text again. Removed labels prevent late
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

Controlled tests cover JSON replay equivalence, stable IDs, restored-history validation, interrupted
round recovery, pending-suffix continuation, clear/cancellation, replayed deduplication,
deadlines, untimed play, duplicates, queueing, retries, evidence validation,
Jev decisions/refusals, bounded batches, retained probabilities, removals, cancellation, unmount,
and final capture draining. The clothing regression uses simulated extraction and Jev responses:
it verifies wiring for skirt, pants, and joggers, not real-model accuracy. Real recognition and model quality
need browser/model playtesting. Production hosts must serve the transcription utility's worker
assets and cross-origin isolation headers; the Vite plugin handles local dev and preview.

To prepare a standalone copy, run `pnpm examples:copy demos/brainstorm-react /tmp/my-brainstorm`,
then install and build inside that new directory. The manifest uses registry library versions.
`pnpm demos:copy-check brainstorm-react` verifies a copy against freshly packed local libraries.
No sibling demo imports are used.

Changing gallery inference settings or preview mode aborts setup and pending judging, ends an
active round, and keeps accepted notes on the board. **Next round** explicitly prepares the new
connection before revealing a fresh challenge. Leaving the demo cancels setup and drains capture.
