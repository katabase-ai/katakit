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

`makeTranscriptIngestionPlugin({ turnSilenceMs?, forward? })` creates a factory of type `TranscriptIngestion`. Call `.configure({})` separately for each independent session; configuration creates the local event source.

`turnSilenceMs` defaults to `1400` and must be a nonnegative finite number. The plugin groups successive segments from the same source and speaker until a timestamped gap exceeds that threshold, the source or speaker changes, or no new segment arrives for that many milliseconds. A source that delivers a long turn only after it ends cannot be made more responsive by lowering this setting.

## Methods

Read these through `running.getMethods(TranscriptIngestionPlugin)`:

- `ingestSegment(segment)`: accept a finalized `{ id, sourceId, text, speaker?, startMs?, endMs? }`. Repeated IDs within one source and blank text are ignored.
- `updateProvisional(text)`: replace the current interim text without finalizing a turn.
- `flush()`: finalize the current turn now and clear interim text.
- `reset()`: begin a new session by clearing completed and current turns, provisional text, the pending timer, and seen segment IDs. It publishes a local reset event without finalizing the old turn.
- `close()`: flush, cancel the timer, and complete the live event stream. The application must stop its audio or transcript source separately.

## Events and observables

Read these through `running.getObservables(TranscriptIngestionPlugin)`:

- `events$`: a **live**, synchronous stream of `{ type: 'provisional', text }`, `{ type: 'segment', segment }`, `{ type: 'turn', turn }`, and `{ type: 'reset' }` events. It does not replay earlier events. Subscribers can react to a segment or provisional update without waiting for turn silence.
- `conversationTurns$`: completed turns derived from local turn events, initially `[]`, with `get()` for the latest array.
- `currentTurn$` and `provisional$`: the unfinished turn and interim recognition text, each initially `undefined` and exposing `get()`.
- `lastHeard$`: the current turn's finalized words, or the latest completed turn's words after flush. It stays unchanged by provisional updates and clears on reset. Its `get()` is initially `undefined`.

## Effects and lifecycle

The plugin declares no runtime effects. `ingestSegment` manages a silence timer that finalizes a turn; `reset()` cancels it and clears the session, while `close()` flushes before completing the event stream. Stop and drain the input source before `close()` so its final segments can still be accepted. Calls to ingest, update provisional text, or reset after close are ignored.

## Event-log forwarding

Transcript state is assembled locally. To forward selected events into an application-owned
log, provide `forward.createEvent` and `forward.emitEvent` when constructing the plugin:

```ts
const TranscriptIngestionPlugin = makeTranscriptIngestionPlugin({
  forward: {
    // Only completed turns are durable here; map them to your own validated event shape.
    createEvent: event =>
      event.type === 'turn' ? { type: 'TranscriptTurn', turn: event.turn } : undefined,
    emitEvent: event => hostEventLog.emitEvent(event),
  },
});
```

The callback is invoked synchronously after the local event is published; returning `undefined` from `createEvent` skips forwarding. This is a **forward-only** integration: `conversationTurns$` derives from local events, not from the application's persisted or hydrated event log. The application must handle rehydration separately if it needs saved turns after a reload. Provisional text can be consumed locally without persisting it.

`examples/demos/transcription-react/` is a feature demo. For copyable application integrations and their verification limits, see [Starters](../../starters/README.md), including the [Obsidian starter](../../starters/obsidian.md).

## Microphone and model integration

Use the standalone [transcription utilities](../transcription.md) for Moonshine/Whisper model loading,
microphone capture, and WASM/worker asset setup. Connect `onFinal` to `ingestSegment`,
`onProvisional` to `updateProvisional`, and `onStop` to `flush`. Neither package depends on
the other at runtime; the application composes them through structural callback types.
