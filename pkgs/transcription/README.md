# @katakit/transcription

Framework- and source-neutral Katakit plugin that groups finalized speech segments into
conversation turns. `events$` publishes live provisional, segment, and completed-turn events;
`conversationTurns$` derives completed turns from those local events; `lastHeard$` exposes
the latest finalized text without the full turn list. `updateProvisional(text)`
shows revisable recognition text without committing it; `ingestSegment(segment)` accepts
finalized lines, deduplicated by source and line ID. `flush()` finalizes an outstanding turn
(for example on Stop); `reset()` clears a session by publishing a local reset event;
`close()` clears the timer and completes the local event stream.
The host still owns its microphone, model, and their lifecycle.

Configure `turnSilenceMs` to adjust turn boundaries. A source that delivers only long,
late final segments cannot be made low-latency by this setting; it must provide
interim updates. Transcripts are in memory by default and are **not persisted**. Optional
`forward.createEvent`/`forward.emitEvent` callbacks map and send selected events to a host-owned
event log; saved history is not automatically replayed into the plugin on restart.
