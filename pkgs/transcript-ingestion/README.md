# @katakit/transcript-ingestion

Use `makeTranscriptIngestionPlugin({ turnSilenceMs })` to record provisional and finalized utterances in Katakit's built-in event log. Read the current draft and pending turn, subscribe to completed turns, or restore the transcript from recorded history.

Turn assembly supports a single speaker: a change of speaker label does not split a turn. A turn completes after `turnSilenceMs` without another finalized utterance (default: 1400 ms).

See the [plugin reference](../../docs/pages/reference/plugins/transcript-ingestion.md) for an example and the public streams. The host owns its recognizer; the independent [transcription utilities](../transcription/README.md) provide microphone and PCM inputs.
