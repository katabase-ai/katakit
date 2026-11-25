import { makeKatakit } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import type { TranscriptionSegment } from '@katakit/transcription';

// Keep recognition separate from Katakit: finalized segments become turns here.
export const createTranscriptSession = () => {
  const turnSilenceMs = 1400;
  const Transcript = makeTranscriptIngestionPlugin({ turnSilenceMs });
  const kit = makeKatakit({ plugins: [Transcript.configure({})] });
  const methods = kit.start().getMethods(Transcript);
  const { collectedConversationTurns$, pendingConversationTurn$, provisionalUtterance$ } =
    kit.getObservables(Transcript);
  const seen = new Set<string>();
  let previous: TranscriptionSegment | undefined;
  return {
    turns$: collectedConversationTurns$,
    pending$: pendingConversationTurn$,
    provisional$: provisionalUtterance$,
    onProvisional: (text: string) =>
      methods.updateProvisionalUtterance({ speaker: 'microphone', text: text.trim() }),
    onFinal: (segment: TranscriptionSegment) => {
      const id = JSON.stringify([segment.sourceId, segment.id]);
      const text = segment.text.trim();
      if (!text || seen.has(id)) return;
      seen.add(id);
      if (
        previous &&
        (previous.sourceId !== segment.sourceId ||
          (segment.startMs !== undefined &&
            previous.endMs !== undefined &&
            segment.startMs - previous.endMs > turnSilenceMs))
      )
        methods.flush();
      previous = segment;
      methods.ingestUtterance({
        id,
        speaker: segment.sourceId,
        text,
        startMs: segment.startMs ?? 0,
        endMs: segment.endMs ?? segment.startMs ?? 0,
      });
    },
    onStop: () => {
      methods.flush();
      if (provisionalUtterance$.get()?.text)
        methods.updateProvisionalUtterance({ speaker: 'microphone', text: '' });
    },
    close: methods.close,
  };
};
