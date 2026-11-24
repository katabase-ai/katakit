# Transcript ingestion

This plugin accepts source-neutral text segments and assembles conversation turns.
Recognition, raw audio, permissions, model loading, and diarization adapters stay outside it.

- Preserve the supplied utterance ID, speaker, text and audio timestamps. Source adaptation
  and retransmission deduplication belong to the producer.
- Derive provisional, pending and completed views from core's built-in log. Replay must
  not start a silence timer or generate new turn IDs.
- Turn grouping currently uses delivery-time silence, not speaker labels or audio gaps.
  The host owns its audio sources; the plugin's `close()` cancels only its timer.
