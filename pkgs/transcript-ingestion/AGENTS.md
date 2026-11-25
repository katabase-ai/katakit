# Transcript ingestion

This plugin accepts source-neutral text segments and assembles conversation turns.
Recognition, raw audio, permissions, model loading, and diarization adapters stay outside it.

- Preserve supplied source/segment/turn IDs, speaker, text and audio timestamps.
  Deduplicate segments by source and segment identity, including after hydration.
- Derive finalized pending and completed views from core's built-in log through one
  atomic projection. Provisional input is transient and never restored.
- Replay must not append events, start a silence timer, or generate replacement IDs.
  Source/speaker/timestamp boundaries are deterministic; wall-clock silence is live-only.
- The host stops and drains its sources. Explicit flush may finalize restored content;
  close flushes live-owned pending content only and releases timers/readers. Reset
  discards pending content and opens a fresh identity scope.
