import { makeKatakit, skipReplay } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import type { TranscriptionSegment } from '@katakit/transcription';
import { map } from 'rxjs';

export type SourceSegment = TranscriptionSegment & { speaker?: string };
// Ingestion takes numeric audio offsets. Keep missing offsets distinct from a genuine 00:00.
const sourceTimes = (turn: { startMs: number; endMs: number }) => ({
  startMs: turn.startMs < 0 ? undefined : turn.startMs,
  endMs: turn.endMs < 0 ? undefined : turn.endMs,
});

/** The capture source supplies IDs scoped to a session. Only accepted turns enter the demo history. */
export const createTranscriptInput = () => {
  const turnSilenceMs = 1400;
  const transcript = makeTranscriptIngestionPlugin({ turnSilenceMs });
  const kit = makeKatakit({ plugins: [transcript.configure({})] }).start();
  const input = kit.getMethods(transcript);
  const views = kit.getObservables(transcript);
  const seen = new Set<string>();
  let previous: SourceSegment | undefined;
  let closed = false;
  const flush = () => {
    if (closed) return;
    input.flush();
    if (views.provisionalUtterance$.get()?.text)
      input.updateProvisionalUtterance({ speaker: 'input', text: '' });
  };
  return {
    turns$: views.conversationTurns$.pipe(
      skipReplay(),
      map(turn => ({
        ...turn,
        ...sourceTimes(turn),
        sourceId: previous!.sourceId,
        speaker: previous!.speaker,
      }))
    ),
    currentTurn$: views.pendingConversationTurn$.pipe(
      map(turn => (turn ? { ...turn, ...sourceTimes(turn) } : undefined))
    ),
    provisional$: views.provisionalUtterance$.pipe(map(value => value?.text || undefined)),
    ingestSegment: (segment: SourceSegment) => {
      const text = segment.text.trim();
      const id = JSON.stringify([segment.sourceId, segment.id]);
      if (closed || !text || seen.has(id)) return;
      seen.add(id);
      if (
        previous &&
        (previous.sourceId !== segment.sourceId ||
          previous.speaker !== segment.speaker ||
          (segment.startMs !== undefined &&
            previous.endMs !== undefined &&
            segment.startMs - previous.endMs > turnSilenceMs))
      )
        input.flush();
      previous = segment;
      input.ingestUtterance({
        id,
        speaker: segment.speaker ?? segment.sourceId,
        text,
        startMs: segment.startMs ?? -1,
        endMs: segment.endMs ?? -1,
      });
    },
    updateProvisional: (text: string) => {
      if (!closed) input.updateProvisionalUtterance({ text: text.trim(), speaker: 'input' });
    },
    flush,
    close: () => {
      closed = true;
      input.close();
    },
  };
};
