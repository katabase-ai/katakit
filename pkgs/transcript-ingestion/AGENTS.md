# Transcript ingestion

This plugin accepts source-neutral text segments and assembles conversation turns.
Recognition, raw audio, permissions, model loading, and diarization adapters stay outside it.

- Preserve caller-supplied source IDs, segment IDs, speaker information, and timestamps.
  Keep retransmission deduplication and source/speaker turn boundaries explicit.
- Separate provisional text and live silence timers from replayable finalized content.
  Finalized transcript content must ultimately derive from the caller's event log.
  The current local Subject plus optional `forward` adapter is an identified migration
  gap; do not describe it as event-log-backed replay or copy it into new stateful plugins.
- Keep event mapping caller-owned. Design the log-backed migration with explicit reset,
  hydration, deduplication, and live-versus-replay semantics; preserve generic text input.
- When changing lifecycle behavior, verify stop/drain, flush, repeated close, pending
  timers, and multiple source/speaker boundaries. The host stops its audio sources.
