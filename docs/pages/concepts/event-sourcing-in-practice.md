# Event-sourcing implementation standards

After the [message-list tutorial](README.md), use these standards to review a new
event-sourced feature or a migration. The [design guide](event-sourcing.md) explains how
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
   random draws, timer starts, or resource acquisition. Test explicit live resumption
   separately. See [Bingo's projection tests](https://github.com/katabase-ai/katakit/blob/main/examples/demos/bingo/tests/plugin.test.ts)
   and [Notes' behavior tests](https://github.com/katabase-ai/katakit/blob/main/examples/demos/notes/tests/notesPlugin.test.ts).

These standards do not mandate filenames, one event per action, disk persistence, or
schemas for purely in-memory events. Choose those according to the application's behavior.
For a cutover from mutable state, also follow
[Migrate an existing application](../getting-started/migrate-to-event-sourcing.md).
