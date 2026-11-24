# @katakit/transcript-ingestion

The plugin records utterances in core's built-in event log and groups them into conversation turns. The application supplies text and owns its audio source and storage.

## Example

```ts
import { makeKatakit } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';

const Transcript = makeTranscriptIngestionPlugin();
const kit = makeKatakit({ plugins: [Transcript.configure({})] }).start();
const input = kit.getMethods(Transcript);
input.updateProvisionalUtterance({ speaker: 'mic', text: 'Hel' });
input.ingestUtterance({ id: 'line-1', speaker: 'mic', text: 'Hello', startMs: 0, endMs: 500 });
console.log(kit.getObservables(Transcript).pendingConversationTurn$.get()?.text); // Hello
```

## Configuration

`turnSilenceMs` defaults to `1400`. Each ingested finalized utterance restarts the timer. When no more arrive within that interval, the plugin records the pending turn with a new ID. The timer measures time between deliveries, not between audio timestamps.

Multi-speaker turn assembly is not currently supported. A `speaker` label describes an utterance; changing it does not split the turn, and a completed turn has no speaker label.

## Methods

- `updateProvisionalUtterance({ text, speaker })` records a draft. The current provisional becomes `null` on either a finalized utterance or a completed turn.
- `ingestUtterance({ id, text, speaker, startMs, endMs })` records the input as supplied. If a source delivers a final twice, the producer must deduplicate it to avoid recording both.
- `close()` cancels the live turn timer. The input owner stops its audio source separately.

## Events and observables

`TranscriptIngestionEvent` is the union of `utteranceAdded`, `provisionalUtteranceAdded`, and `conversationTurnAdded` recorded events. Like other core events, each has `meta.seq` and `meta.timestamp`.

- `utterances$`, `provisionalUtterances$`, and `conversationTurns$` deliver individual payloads, including replayed ones. Use core's `skipReplay()` for live-only effects.
- `collectedUtterances$` and `collectedConversationTurns$` expose arrays. Use `.get()` to read the current snapshot.
- `pendingConversationTurn$` and `provisionalUtterance$` expose the current values, initially `null`.

Supply complete recorded history via `makeKatakit({ existingEvents, plugins })` to reconstruct the projections. Replay preserves finalized turn IDs and does not start a timer. See [persistence](persistence.md) for storage and the [transcription utilities](../transcription.md) for recognition and capture.
