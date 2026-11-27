# Changelog

## 0.2.0

- Restore draft text, pending turns, and completed turns from core's event log without restarting timers or generating replacement IDs.
- **Breaking:** Replace `updateProvisional(text)` with `updateProvisionalUtterance({ text, speaker })` and `ingestSegment` with `ingestUtterance({ id, text, speaker, startMs, endMs })`. Deduplicate retransmissions at the source.
- **Breaking:** Use core's log instead of local `events$` or `forward` callbacks. `conversationTurns$` now emits individual turns; use `collectedConversationTurns$` for the list. Use `provisionalUtterance$` and `pendingConversationTurn$` for in-progress text.
- **Breaking:** Start a fresh runtime instead of calling `reset()`. Drain input and call `flush()` before `close()`, which now only cancels the silence timer.

## 0.1.0

- Initial release of source-neutral transcript ingestion with segment deduplication, provisional text, and silence-delimited conversation turns.
- Expose live observables, flush/reset/close methods, and optional event-forwarding callbacks.
- Keep transcript state in memory; forwarded history is not automatically restored.
