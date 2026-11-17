# Transcript ingestion

`@katakit/transcript-ingestion` groups finalized text segments from any source into conversation turns. It does **not** capture audio, load a speech model, or persist transcripts. The application owns the source and its lifecycle.

`makeTranscriptIngestionPlugin({ turnSilenceMs?, forward? })` defaults to a 1400 ms silence threshold. It must be a nonnegative finite number. The plugin groups successive segments from the same source and speaker until a timestamped gap exceeds that threshold, the source or speaker changes, or no new segment arrives for that many milliseconds. A source that delivers a long turn only after it ends cannot be made more responsive by lowering this setting.

## Events and observables

Configure the plugin with `.configure({})` and register it with `makeKatakit`. The running plugin exposes:

- `ingestSegment(segment)`: accept a finalized `{ id, sourceId, text, speaker?, startMs?, endMs? }`. Repeated IDs within one source and blank text are ignored.
- `updateProvisional(text)`: replace the current interim text without finalizing a turn.
- `events$`: a **live**, synchronous stream of `{ type: 'provisional', text }`, `{ type: 'segment', segment }`, `{ type: 'turn', turn }`, and `{ type: 'reset' }` events. It does not replay earlier events. Subscribers can react to a segment or provisional update without waiting for turn silence.
- `conversationTurns$`: completed turns derived from local turn events, with `get()` for the latest array; `currentTurn$` and `provisional$` expose the current unfinished text separately, also with `get()`.
- `lastHeard$`: the current turn's finalized words, or the latest completed turn's words after flush. It stays unchanged by provisional updates and clears on reset. Its `get()` is initially `undefined`.
- `flush()`: finalize the current turn now and clear interim text.
- `reset()`: begin a new session by clearing completed and current turns, provisional text, the pending timer, and seen segment IDs. It publishes a local reset event without finalizing the old turn.
- `close()`: flush, cancel the timer, and complete the live event stream. The application must stop its audio or transcript source separately.

The [accepted stateful-plugin contract](../../concepts/plugins.md#official-stateful-plugin-contract)
requires an event log as the source of application state. The current ingestion implementation
has not yet been aligned with that contract: it maintains local state and accepts optional
forwarding callbacks. Registering an event log does not change this behavior. The following
documents that current bridge, not a complete event-log-backed ingestion design.

To forward selected events into an application-owned log, provide `forward.createEvent` and
`forward.emitEvent` when constructing the plugin:

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

`demos/transcription-react/` is an application demo, not a template; [Templates and applications](../../concepts/templates.md) explains that distinction. For a minimal text-only use of this plugin inside Obsidian, see the [Obsidian starter guide](../../starters/obsidian.md).

## Microphone and model integration

Use the standalone [transcription utilities](../transcription.md) for Moonshine/Whisper model loading,
microphone capture, and WASM/worker asset setup. Connect `onFinal` to `ingestSegment`,
`onProvisional` to `updateProvisional`, and `onStop` to `flush`. Neither package depends on
the other at runtime; the application composes them through structural callback types.
