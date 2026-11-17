# Changelog

## 0.1.0

- Initial release of source-neutral transcript ingestion with segment deduplication, provisional text, and silence-delimited conversation turns.
- Expose live observables, flush/reset/close methods, and optional event-forwarding callbacks.
- Keep transcript state in memory; forwarded history is not automatically restored.
