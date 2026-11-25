# @katakit/transcript-ingestion

`@katakit/transcript-ingestion` groups finalized text segments from any source into conversation turns. It does **not** capture audio, load a speech model, or persist transcripts. The application owns the source and its lifecycle.

## Example

```ts
import { makeKatakit } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';

const TranscriptIngestionPlugin = makeTranscriptIngestionPlugin();
const running = makeKatakit({ plugins: [TranscriptIngestionPlugin.configure({})] }).start();
const transcript = running.getMethods(TranscriptIngestionPlugin);
transcript.ingestSegment({ id: '1', sourceId: 'example', text: 'Hello' });
transcript.flush();
console.log(running.getObservables(TranscriptIngestionPlugin).conversationTurns$.get()[0]?.text);
// Hello
transcript.close();
```

## Configuration

`makeTranscriptIngestionPlugin({ turnSilenceMs?, eventLog?, forward? })` creates a factory of type `TranscriptIngestion`. Call `.configure({})` for each session. Without `eventLog`, each runtime owns a private in-memory `@katakit/event-log`; install that peer alongside `@katakit/core` and `rxjs`.

`turnSilenceMs` defaults to `1400` and must be a nonnegative finite number. The plugin groups successive segments from the same source and speaker until a timestamped gap exceeds that threshold, the source or speaker changes, or no new segment arrives for that many milliseconds. A source that delivers a long turn only after it ends cannot be made more responsive by lowering this setting.

## Methods

Read these through `running.getMethods(TranscriptIngestionPlugin)`:

- `ingestSegment(segment)`: accept a finalized `{ id, sourceId, text, speaker?, startMs?, endMs? }`. Repeated IDs within one source and blank text are ignored.
- `updateProvisional(text)`: replace the current interim text without finalizing a turn.
- `flush()`: finalize the current turn now and clear interim text.
- `reset()`: record one reset without finalizing the old turn. The projection clears completed/current turns and segment identity history; provisional text and the pending timer are cleared too.
- `close()`: flush live pending content, cancel the timer, and release the plugin's log subscriptions. Closing a restored-only runtime does not append a turn. The application must stop and drain its audio or transcript source separately.

## Events and observables

Read these through `running.getObservables(TranscriptIngestionPlugin)`:

- `events$`: a **live**, synchronous stream of `{ type: 'provisional', text }`, `{ type: 'segment', segment }`, `{ type: 'turn', turn }`, and `{ type: 'reset' }` events. It does not replay earlier events. Subscribers can react to a segment or provisional update without waiting for turn silence.
- `state$`: atomic `{ segments, conversationTurns, currentTurn }` projection with `get()`. Prefer this when reading completed and pending content together so a flush cannot briefly show the same turn twice.
- `segments$`: finalized segments since the latest reset, deduplicated by `(sourceId, id)`.
- `conversationTurns$`: completed turns derived from the log, with `get()` for the latest array.
- `currentTurn$` and `provisional$`: the unfinished turn and interim recognition text, each initially `undefined` and exposing `get()`.
- `lastHeard$`: the current turn's finalized words, or the latest completed turn's words after flush. It stays unchanged by provisional updates and clears on reset. Its `get()` is initially `undefined`.

## Effects and lifecycle

The plugin declares no runtime effects. Only fresh `ingestSegment` calls start a silence timer. Replay leaves a pending turn open until fresh input or explicit `flush()`. Reset, externally recorded resets/turns, and close cancel the timer. Stop and drain the input source before `close()` so its final segments can still be accepted. Every input method, including `flush()`, is a no-op after close. Close does not close the caller's log, model, or capture device.

## Caller-owned history and mappings

The application's event log is the sole authority for finalized content. Construct its runtime
first, then connect its replaying observable and synchronous validated emitter. The host owns
the event schema, storage, and mappings. For a log whose records already use the transcript shape:

```ts
const TranscriptIngestionPlugin = makeTranscriptIngestionPlugin({
  eventLog: {
    events$: hostEvents$,
    emitEvent: hostEmitEvent,
    toEvent: event => event,
    fromEvent: event => event,
  },
});
```

`toEvent` must map all three `TranscriptRecordedEvent` variants: `segment`, `turn`, and `reset`.
`fromEvent` maps those host records back and returns `undefined` for unrelated events.
The event-log emitter validates live writes through the host's synchronous Standard Schema.
Before supplying `initialEvents`, validate the entire restored array with the host schema;
`parseTranscriptRecordedEvent(unknown)` validates transcript records and throws on malformed
identity, text, speaker, or nonfinite timestamps. It does not generate IDs or normalize saved text.
The ingestion projection validates mapped records too, but cannot validate unrelated host content.

Hydration replays records without appending events, generating IDs, loading models, starting
capture, or starting timers. Segment IDs and turn IDs survive restoration. Duplicate segments
are ignored by `(sourceId, id)`, including after restoration; reset allows those identities to be
used again. Duplicate completed turns are ignored by source and turn ID. Legacy turn-only
records work, but cannot deduplicate old segments whose identities were never stored.

Raw segment-only snapshots split deterministically at source, speaker, and timestamp boundaries.
They cannot reconstruct unrecorded wall-clock silence boundaries; retain turn events for exact
live/replay equivalence. Keep `turnSilenceMs` stable when replaying raw segment history.
`reduceTranscriptEvent(state, event, turnSilenceMs?)` exposes this pure projection for host plugins.

`events$` remains live-only, including externally appended mapped records. Use it for immediate
notifications, not history recovery. The legacy `forward` sink still forwards locally requested
events after publication, but is not a second authority or a hydration mechanism.

`examples/demos/transcription-react/` is a feature demo. For copyable application integrations and their verification limits, see [Starters](../../starters/README.md), including the [Obsidian starter](../../starters/obsidian.md).

## Microphone and model integration

Use the standalone [transcription utilities](../transcription.md) for Moonshine/Whisper model loading,
microphone capture, and WASM/worker asset setup. Connect `onFinal` to `ingestSegment`,
`onProvisional` to `updateProvisional`, and `onStop` to `flush`. Neither package depends on
the other at runtime; the application composes them through structural callback types.
