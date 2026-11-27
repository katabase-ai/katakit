# Migrate an existing application

Use this walkthrough to migrate an application that currently keeps mutable state in React,
a store, or service objects to event sourcing. The result is one authoritative event history
and projections that reconstruct application content. You can preserve user-visible behavior
while changing the internal state model and the interfaces that consume it.

Read [Designing event-sourced applications](../concepts/event-sourcing.md) for the design
principles and [Start a runtime](../concepts/runtime.md) for the Katakit APIs. This is an
application architecture migration; upgrading an already event-sourced app's event schemas
or package versions is a separate task.

## 1. Inventory behavior and state

Choose one bounded feature first. List its user actions, external inputs, stored data,
observable results, and resource owners. Capture a few representative scenarios before
changing the implementation: add content, correct it, clear it, and leave the view while
work is pending, where applicable.

For a message list, an existing update might be:

```ts
let messages: { id: string; text: string }[] = [];

function addMessage(text: string) {
  messages = [...messages, { id: crypto.randomUUID(), text }];
}
```

Here `messages` is the authority and the current array is all that remains of past actions.
Inventory other writers too: a component setter, import button, model callback, and storage
loader might all update the same content. A draft input and an in-flight request controller
have different lifetimes and need not become persistent events.

## 2. Design the facts before adapting the frontend

Describe the feature without referring to its current field names or component tree. For
this example, users add messages and can import a previously saved list. We need the accepted
text and stable identity of each message, plus an honest boundary for imported data.

The following is a standalone TypeScript domain model. It deliberately contains no React,
Katakit, storage, or model calls:

```ts
type Message = Readonly<{ id: string; text: string }>;
type MessageEvent =
  | { type: 'messageAdded'; message: Message }
  | { type: 'messagesImported'; messages: readonly Message[] };

function projectMessages(messages: readonly Message[], event: MessageEvent): readonly Message[] {
  switch (event.type) {
    case 'messageAdded':
      return [...messages, { ...event.message }];
    case 'messagesImported':
      return event.messages.map(message => ({ ...message }));
  }
}

const history: MessageEvent[] = [
  { type: 'messagesImported', messages: [{ id: 'legacy-1', text: 'Earlier message' }] },
  { type: 'messageAdded', message: { id: 'new-1', text: 'Hello' } },
];
const restored = history.reduce<readonly Message[]>(projectMessages, []);
console.log(restored.map(message => message.text)); // ['Earlier message', 'Hello']
```

In this design, import replaces the list and is permitted only as the opening event by the
live/import admission path. The reducer assumes valid history. Validate that constraint,
payload shapes, and unique message IDs before accepting external history or commands.
If the product supports merging imports later, define that behavior and its identity rules
explicitly instead of reusing this replacement event silently.

Write down the events, projection seed, session boundary, resource owners, and replay
expectations before wiring them into the existing UI. If the design simply mirrors every
setter, reconsider it using only the behavior inventory. A fresh design pass from that
inventory can help; it need not discard known integration constraints or user requirements.

## 3. Connect the model to Katakit

Use core's built-in `EventLogPlugin`. Declare the domain events as TypeScript
`KatakitEvent<Payload>` types, which include core's sequence and timestamp metadata.
Following the [projection tutorial](../concepts/event-history.md), select those events
from the log, then accumulate them with `scan(projectMessages, [])` or `evolve` with an
explicit initial emission. Expose the result as an observable; it has no independent setter.
Validate external commands and serialized history at their input boundaries; typed in-memory
replay does not need a second set of runtime event schemas.

Following [Add a plugin and an effect](../concepts/plugins.md), make `addMessage(text)`:

1. Validate the proposed text and the current session's admission rules.
2. Assign the message ID once.
3. Emit `messageAdded` with that ID and the accepted text.

The projection reads the recorded ID; it never calls `crypto.randomUUID()`. Record any
random initialization the same way. Bingo records the dealt squares, rather than running
the pack shuffle during reconstruction.

Change UI reads to consume the projections and UI actions to call the methods. Use
[React-RxJS bindings](../reference/react.md#react-rxjs-bindings) for React subscriptions.
You may retain a derived combined view for convenience; it must not become another writable
authority. Once a feature is cut over, remove its old setters, content subjects, and writes
from callbacks. Keep drafts and resource status with their named transient owners.

Migrate one coherent feature at a time. If old and new features coexist, specify which one
owns each piece of content and how they communicate. Avoid writing both the old store and
the new log for the same content without a deliberate, verified cutover strategy.

## 4. Decide what happens to existing data

A saved array or database snapshot cannot reveal the sequence of actions that produced it.
Choose and document a policy before replacing storage:

- **Start fresh:** appropriate for disposable demo state when losing it is acceptable.
- **Import a baseline:** validate the old snapshot and record its known content in an explicit
  import event, as above. Preserve existing IDs, or assign missing IDs once during conversion.
  Do not fabricate historical add/edit actions, their times, or their provenance.
- **Migrate durable data before cutover:** define the conversion format, backup/recovery
  procedure, and a durable import marker so retrying the migration cannot duplicate content.

An import's recording timestamp describes the import, not when each original action happened.
Keep unknown historical information unknown. Test the converted content and a retry of the
conversion before removing the old data. For the message-list example, compare the baseline
projection with the original array, then verify that a new addition survives restoration.

Katakit's event log is in memory until the application connects storage. Follow
[Restore and save history](../concepts/persistence.md) for loading, validating metadata,
and saving new events. If you change event schemas later, separately define which old
histories the new reader accepts or converts.

## 5. Separate replay from live work

List callbacks that call models, start capture, schedule timers, or write to external services.
For each one, decide its live trigger, how its result becomes an event, and what happens
after cancellation. Keep projections pure. Use `skipReplay()` on event-log effects where
subscription-time history must not trigger work; do not remove historical events from the
projection itself.

For a model-driven feature, record validated accepted output and the inputs it covers.
Structured notes records the outline, its IDs, and a processed-turn cursor together. Replay
then restores that result without re-prompting the model. New work on unprocessed inputs
requires an explicit live connection. The [design guide](../concepts/event-sourcing.md#own-live-work-and-shutdown)
explains how that cursor makes coalesced request triggers safe.

Define session replacement and shutdown before connecting live inputs. Account for final
input draining, pending-turn flushing, subscription removal, cancellation, and late-result
rejection. A new runtime does not automatically stop the old one's resources. Consult
[ownership and shutdown](../reference/core.md#ownership-and-shutdown) for the actual API limits.

## 6. Prove the cutover

Run the original behavior scenarios through the migrated feature. Capture its recorded
history, construct a fresh instance, and compare its content with the live result. For the
message example, compare IDs and text; for notes, include the accepted outline and cursor.

Verify the risks relevant to this feature:

- Empty history, imported baseline, and a sequence of new changes reconstruct correctly.
- Replay neither appends new facts nor calls models, generates IDs, or reacquires resources.
- Duplicate or invalid inputs follow the declared admission policy.
- Pending work retains all required inputs and accepts no stale results after clear/close.
- Starting another session follows the declared carry-over policy.
- The UI has no remaining path that bypasses the log to edit replayable content.

For Katakit demos, also run the affected behavior checks and applicable standalone copy
checks, and exercise gallery navigation when lifecycle wiring changes. Report controlled
test results separately from live microphone/model and platform checks.

## Use an agent

The repository's
[`event-sourced-application` skill](https://github.com/katabase-ai/katakit/blob/main/.agents/skills/event-sourced-application/SKILL.md)
organizes this workflow. Give the agent your application path, required behavior, and saved-data
policy. Ask for its design brief before it changes the implementation, then have it carry
the design through the cutover and verification. The skill also has a build-from-scratch
path for new applications.
