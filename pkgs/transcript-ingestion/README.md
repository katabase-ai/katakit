# @katakit/transcript-ingestion

`makeTranscriptIngestionPlugin` constructs a framework- and source-neutral plugin that groups finalized speech segments into
conversation turns. `events$` publishes live provisional, segment, and completed-turn events;
`conversationTurns$` derives completed turns from an event log; `lastHeard$` exposes
the latest finalized text without the full turn list. `updateProvisional(text)`
shows revisable recognition text without committing it; `ingestSegment(segment)` accepts
finalized lines, deduplicated by source and line ID. `flush()` finalizes an outstanding turn
(for example on Stop); `reset()` clears a session by recording a reset event;
`close()` drains live pending input, clears the timer and releases the plugin's readers.
The host owns its audio source and stops it separately.

Configure `turnSilenceMs` to adjust turn boundaries. A source that delivers only long,
late final segments cannot be made low-latency by this setting; it must provide
interim updates. Transcripts are in memory by default and are **not persisted**. Install
`@katakit/core` and `rxjs` alongside this package. Pass `eventLog`
with the caller's replaying `events$`, synchronous `emitEvent`, and `toEvent`/`fromEvent`
mappings to derive content from the application's log. Validate restored records before
constructing the log; `parseTranscriptRecordedEvent` validates the transcript portion.
The zero-configuration API uses the same runtime's built-in core `EventLogPlugin`.
It writes `utteranceAdded`, `conversationTurnAdded`, and `transcriptReset` records;
provisional input stays transient. `ingestUtterance`/`updateProvisionalUtterance` and
collected/pending observable aliases support the core-style API. Core's default emitter
does not validate: callers supplying a mapped log must validate live writes and restored
history before core sees them. `fromTranscriptIngestionEvent` and
`toTranscriptIngestionEvent` bridge flat core payloads and canonical transcript records.

`state$` provides atomic `{ segments, conversationTurns, currentTurn }` snapshots.
`reduceTranscriptEvent` supports pure projections in other plugins. Replay does not
append events, start silence timers, or generate IDs. The legacy `forward` sink remains
available for live notifications, but is not a replay integration.
See the [reference guide](../../docs/pages/reference/plugins/transcript-ingestion.md)
for hydration, reset, and lifecycle contracts.

## Transcription utilities

[`@katakit/transcription`](../transcription/README.md) provides independent microphone and PCM transcription
utilities for Moonshine and Whisper. It has no React, RxJS, or plugin-system dependency.
The transcript ingestion plugin does not depend on that utility package. Connect its callbacks
when you want recognized speech grouped into conversation turns:

```ts
import { createMicrophoneTranscriber } from '@katakit/transcription/browser';

// methods comes from your running transcript ingestion plugin.
const input = createMicrophoneTranscriber({
  model: 'moonshine-small',
  onProvisional: methods.updateProvisional,
  onFinal: methods.ingestSegment,
  onStop: methods.flush,
});
await input.start();
// Later: await input.stop(); await input.dispose();
```

Use `transcriptionAssetsPlugin` in Vite or `copyTranscriptionAssets` with another toolchain to install
the runtime files. See the utility's README for model requirements, asset hosting, errors,
and examples that do not use a plugin or UI framework.
