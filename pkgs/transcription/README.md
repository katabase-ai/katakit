# @katakit/transcription

Framework- and source-neutral Katakit plugin that groups finalized speech segments into
conversation turns. `updateProvisional(text)` shows revisable recognition text without
committing it; `ingestSegment(segment)` accepts finalized lines, deduplicated by source and
line ID. `flush()` finalizes an outstanding turn (for example on Stop); `close()` clears
the plugin's timer. The host still owns its microphone, model, and their lifecycle.

Configure `turnSilenceMs` to adjust turn boundaries. A source that delivers only long,
late final segments cannot be made low-latency by this setting; it must provide
interim updates. Transcripts are in memory by default and are **not persisted**.
