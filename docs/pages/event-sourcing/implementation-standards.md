# Event-sourcing implementation standards

After the [message-list tutorial](../concepts/README.md), use these standards to review a new
event-sourced feature or a migration. The [design guide](designing.md) explains how
to choose events, projections, sessions, and resource owners; this page says what to
look for in the implementation.

1. **One writer for each piece of content.** Commands validate input and emit accepted
   events; projections read the log. React setters, mutable objects, and writable subjects
   must not independently update the same replayable content. A read-only view may combine
   projected content with transient status.

2. **Events record accepted facts, not setter calls.** Define typed domain events with
   their meaning, producer, stable identity, and necessary provenance. Record a generated
   board, ID, or validated model result once in the live path. Do not require an event for
   every field assignment, or prohibit a whole-result event when that is the meaningful
   accepted fact. See [Bingo's events](https://github.com/katabase-ai/katakit/blob/main/examples/demos/bingo/src/bingo/events.ts)
   and [Notes' accepted outline](https://github.com/katabase-ai/katakit/blob/main/examples/demos/notes/src/notesEvents.ts).

3. **Projections are deterministic and non-mutating.** Give each projection an explicit
   initial value. The same valid history must produce the same content without changing
   event payloads or earlier projected values, reading the clock, generating IDs, or
   invoking external services.

4. **Validate at the boundary that accepts data.** Check commands and model responses
   before emitting events; decode externally stored histories before passing them as
   `existingEvents`. Do not require a runtime schema for every typed event in an in-memory
   demo.

5. **Separate reconstruction from live effects.** Restoring `existingEvents` must
   reconstruct content without starting external work. Every effect that calls a model,
   starts input, or emits a result needs an explicit live trigger and replay policy.
   [`skipReplay()`](../reference/core.md#makeeffect) suppresses synchronous
   subscription-time history on an event-log effect; it is not a global replay mode for
   effects driven by projected state. Resuming unprocessed input after an explicit
   connection is new live work, not replay.

6. **Make asynchronous acceptance explicit.** For each request, identify its trigger,
   cancellation owner, result event, and guard against a late response after clear,
   close, or session replacement. If triggers are coalesced, show why required input
   cannot be lost. [Structured Notes](https://github.com/katabase-ai/katakit/blob/main/examples/demos/notes/src/notesPlugin.ts)
   retains pending turns in the log and advances its cursor only after accepted output;
   `latest` does not cancel its active request.

7. **Define the session boundary in code and tests.** Specify whether a new round gets a
   new runtime or a clear records an event in the existing history. State separately what
   happens to capture, pending work, and connections. Do not rely on a UI remount or an
   assumed core `dispose()` to establish the boundary; core has
   [no general disposal API](../reference/core.md#ownership-and-shutdown).

8. **Require a replay test for content changes.** Run a live sequence, capture its events,
   construct a fresh runtime from them, and compare content, IDs, and derived outputs.
   Assert that reconstruction emits no replacement events and performs no model calls,
   random draws, content-producing timer restarts, or resource acquisition. Test explicit
   live resumption separately. Follow the recipe below; the
   [Bingo projection tests](https://github.com/katabase-ai/katakit/blob/main/examples/demos/bingo/tests/plugin.test.ts)
   and [Notes behavior tests](https://github.com/katabase-ai/katakit/blob/main/examples/demos/notes/tests/notesPlugin.test.ts)
   illustrate parts of it, not a complete checklist.

## Replay test recipe

1. **Create a meaningful live history.** Exercise accepted input and, where supported,
   a correction, clear, or pending operation. Capture the **entire** event log, including
   input-plugin events such as completed transcript turns; filtering down to a feature's
   own events can hide a replay-triggered effect. Save the live content, stable IDs,
   cursors, and derived outputs for comparison.
2. **Reconstruct without starting live work.** Supply that history as `existingEvents`
   to a fresh runtime. Read projections before `start()` when the factory allows it.
   Compare the saved domain values and the complete history, including event order and
   payloads. Do not compare intentionally transient UI status, retry state, or countdowns
   as though they were durable content.
3. **Start the restored runtime and check for side effects.** Subscribe its effects with
   `start()` (or use the factory's equivalent if it starts internally), then settle
   synchronous work and controlled pending tasks. Assert the event log has not grown and
   instrument the relevant boundaries: model calls, ID/random generation, capture or
   resource acquisition, and timers that would produce new content. Merely reading a
   projection before `start()` cannot establish this. A clock read for a transient
   display countdown is not itself a replay failure.
4. **Resume only through an explicit live action.** If the feature supports pending work,
   connect or start it _after_ the inert-replay assertions. Check that eligible input is
   handled once, already-processed input is not repeated, and the accepted result appears
   as a new event. A model call at this point may be correct; it would not have been
   correct during reconstruction.

Add focused boundary tests where the feature needs them: invalid or duplicate input
must not append unintended facts; late responses after clear, close, or session
replacement must not write to the old or new history; a capture-driven feature should
test a final segment delivered during stop/drain and specify whether it is accepted
before sink close. Use controlled callbacks, deferred promises, and fake timers instead
of timing sleeps. Features without a model, microphone, or pending work do not need
tests for resources they never own.

These standards do not mandate filenames, one event per action, disk persistence, or
schemas for purely in-memory events. Choose those according to the application's behavior.
For a cutover from mutable state, also follow
[Migrate an existing application](migration.md).
