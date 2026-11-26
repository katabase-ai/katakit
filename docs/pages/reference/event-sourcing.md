# Designing event-sourced applications

Event sourcing makes recorded events the authority for application content. A **projection**
derives a value from that history: a board, an outline, or a list of messages. Changing that
content means recording another event, rather than editing a second copy of the state.

Use this guide when choosing events and application boundaries. For a first implementation,
follow the [message-list tutorial](../concepts/README.md). For an application that currently
stores mutable state, follow [Migrate an existing application](../getting-started/migrate-to-event-sourcing.md).
The [core reference](core.md) owns the runtime and replay API contracts.

## Start with behavior

Describe what users and external systems can do, what the application must remember, and
what its views must show. Design events from those facts before mapping existing component
state or setters into a plugin. Preserve required behavior; change internal interfaces when
they obscure the domain.

For example, a Bingo player can mark or unmark a square, while recognized speech only marks
a square. The application also needs to remember the actual board that was dealt. These
behaviors suggest different facts from a generic `stateChanged({ state })` event.

Before implementation, write a small design brief:

- Events: meaning, payload, producer, identity, and relevant provenance.
- Projections: initial value, source events, and consumers.
- Sessions: what starts a new history and what survives that boundary.
- Resources: who owns input, requests, timers, subscriptions, and cleanup.
- Replay: which values must be reconstructed, and which work must remain live-only.

## Choose facts that preserve meaning

A command asks the application to do something; an event records what it accepted or what
happened. A method can validate a command and emit no event when it would change nothing.
Projections consume the accepted facts without rerunning command admission.

The [Bingo event definitions](https://github.com/katabase-ai/katakit/blob/main/examples/demos/bingo-react/src/bingo/events.ts)
illustrate three choices:

| Event                                      | Meaning                               | Why record it?                                                 |
| ------------------------------------------ | ------------------------------------- | -------------------------------------------------------------- |
| `gameStarted({ squares })`                 | This exact layout was dealt.          | Replay uses the recorded layout instead of shuffling again.    |
| `squareManuallyChanged({ index, marked })` | A player set a square's marked state. | Manual input can mark or unmark.                               |
| `squareSpoken({ index })`                  | Speech matched a square.              | Speech marks it and preserves a different origin from a click. |

The [Bingo plugin](https://github.com/katabase-ai/katakit/blob/main/examples/demos/bingo-react/src/bingo/plugin.ts)
derives `squares$`, `marked$`, and `winningLanes$`. A winning line needs no separate event
when it is entirely calculable from the marks. Record an award or notification separately
if the product must remember that an external action actually happened.

Separate event types are a judgment call. A single event with an explicit origin field can
also preserve provenance. Choose the representation that expresses the allowed behavior
clearly; avoid optional fields that permit contradictory combinations. Capture provenance
that the application needs or can reasonably use, rather than every available input detail.

Granular events describe meaningful changes, not individual assignments. Sometimes a whole
accepted result is the appropriate fact: the structured notes demo records the validated
outline and its processed-turn cursor together in `notesUpdated`. Replaying that result
does not require the model or its old prompt.

## Give each value one authority

| Kind of value                                                    | Authority and lifetime                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Accepted application content                                     | Events; projections reconstruct it for the session.                     |
| Calculated counts, Markdown, winning lines                       | Projections of recorded content, with no independent setters.           |
| Provisional recognition, input drafts, hover state               | Live input or UI owner; disposable unless the product requires history. |
| Microphone handles, connections, abort controllers, retry timers | Resource owner; created and released explicitly.                        |

An observable is a delivery mechanism, not proof of event sourcing. A writable subject
that holds authoritative content alongside the log still creates two sources of truth.
A derived combined view is fine, including one that combines content and transient status,
provided callers cannot edit it independently of its sources.

Event sourcing also does not imply disk storage. Core's log is in memory. Choose
[persistence](plugins/persistence.md) when history must survive a process or page restart.

## Make replay sufficient and deterministic

Given the same valid history and the same projection rules, reconstruct the same content.
Record the results of nondeterministic work before deriving content from them:

- Store a dealt layout, rather than reshuffling during replay.
- Assign entity IDs once in the live path and record them.
- Record accepted model output, rather than calling the model again.
- Store relevant times as data, rather than reading the current clock in a projection.

Do not mutate recorded payloads or earlier projection values. Validate external inputs
before emission and loaded history before `existingEvents`; restore serialized metadata
such as timestamps according to the application's storage format. Event order and stable
source/entity IDs matter when input can be duplicated or delivered late. Define admission
and deduplication at the appropriate input boundary; core does not infer those policies.

Construct a fresh runtime with `existingEvents` and read projections before `start()` to
check reconstruction separately from live behavior. On an effect that consumes the event
log, [`skipReplay()`](core.md#makeeffect) can exclude synchronous subscription-time history.
Keep that history available to projections. An effect driven by projected state needs an
explicit live-work policy too: filtering one stream is not a general replay mode.

Reconstruction and resuming unfinished work are separate operations. The
[structured notes runtime](https://github.com/katabase-ai/katakit/blob/main/examples/demos/notes-react/src/createNotesDemo.ts)
restores content without a model connection. An explicit connection can then process turns
after the recorded cursor. That is new live work, not replaying previously accepted output.

## Choose session boundaries deliberately

A session is the history whose content belongs together. A new runtime is a useful default
when nothing from one history should affect the next. Bingo uses one runtime per round;
the microphone can outlive it and feed the next round through a new subscription.

A clear operation can instead be meaningful within a session. Structured notes records
`notesCleared` while retaining the transcript and advancing its processed-turn cursor.
Later speech continues the same visit. Neither a universal reset event nor a universal
ban on clear events expresses both applications correctly.

Write down what survives a boundary: input capture, history, connection allowance, and
pending work may each have different owners. A UI remount does not by itself establish a
domain session boundary.

## Own live work and shutdown

For each external operation, identify its trigger, owner, cancellation policy, and the event
that accepts its result. Validate the response before recording it. If requests overlap,
define which result may still be accepted after a clear, replacement, or close. Aborting a
request is useful, but the acceptance path must also reject late responses.

Choose [effect backpressure](core.md#makeeffect) according to what can be lost. `latest`
coalesces pending triggers and does not cancel the active handler. It is suitable for notes
only because pending turns remain recorded and the cursor advances after accepted output;
it would lose work if the discarded trigger were the only copy of an input.

For shutdown, specify an order appropriate to the application: stop new input, drain accepted
input where required, flush pending turns, finish or cancel external work, end owned streams,
and release resources. For session replacement, ensure old producers and late results cannot
write to the replacement session.

Core has [no general stop/dispose API](core.md#ownership-and-shutdown). Ingestion's `close()`
flushes its local stream; it does not stop every plugin, microphone, or request. Removing a
UI subscription does not release the runtime's eager subscriptions either. State exactly
which owner stops each resource rather than promising automatic cleanup.

## Verify the design

Exercise a live interaction, capture its history, and reconstruct it in a fresh instance.
Compare domain content, stable IDs, and derived outputs, excluding intentionally transient
status. Check both an empty history and a meaningful sequence of corrections or clears.
Assert that reconstruction emits no replacement facts and performs no model calls, random
draws, timer restarts, or resource acquisition.

Also test the application-specific risks: duplicate input, input arriving during a request,
invalid output, late results after clear/close, and final input during shutdown. These
checks establish behavior under controlled inputs. Test real microphone/model interaction
and gallery navigation separately when those paths change.

Use the [Bingo projection tests](https://github.com/katabase-ai/katakit/blob/main/examples/demos/bingo-react/src/bingo/plugin.test.ts)
for board reconstruction and the
[structured notes tests](https://github.com/katabase-ai/katakit/blob/main/examples/demos/notes-react/src/notesPlugin.test.ts)
for accepted model output, replay, cancellation, and pending work. They demonstrate specific
contracts; a passing test is not evidence for every lifecycle path in a demo.
