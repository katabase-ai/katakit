# Transcription

`@katakit/transcription` exports `makeTranscriptionPlugin({ turnSilenceMs? })`. The plugin accepts finalized text segments from any source and groups them into conversation turns. It does **not** capture audio, load a speech model, or persist transcripts. The host owns the source and its lifecycle.

`turnSilenceMs` defaults to `1400`. It must be a nonnegative finite number. The plugin groups successive segments from the same source and speaker until a timestamped gap exceeds that threshold, a source or speaker changes, or no new segment arrives for that many milliseconds. A source that delivers a long turn only after it ends cannot be made more responsive by lowering this setting.

## Input and state

Call `makeTranscriptionPlugin(...).configure({})` and register the configured plugin with `makeKatakit`. The running plugin exposes:

- `getMethods(Transcription).ingestSegment(segment)`: accept a finalized `{ id, sourceId, text, speaker?, startMs?, endMs? }`. Repeated `id` values within one `sourceId` are ignored; blank text is ignored.
- `getMethods(Transcription).updateProvisional(text)`: replace the current interim text without adding it to a finalized turn.
- `getObservables(Transcription).state$`: an observable with `get()` returning `{ turns, current?, provisional? }`. `turns` contains finalized turns; `current` is the turn being assembled.
- `getMethods(Transcription).flush()`: finalize the current turn now and clear interim text.
- `getMethods(Transcription).close()`: flush and stop the plugin's turn timer. The host must stop its audio or transcript source separately.

Finalized turns include `id`, `sourceId`, `text`, and available speaker/timestamps. The exported types are `TranscriptSegment`, `TranscriptTurn`, and `TranscriptionState`. No transcript data is saved by this plugin.

`demos/transcription-react/` is a host-specific demonstration, not a template; [Templates and hosts](../../concepts/templates.md) explains that distinction.
