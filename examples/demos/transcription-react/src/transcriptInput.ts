import { makeKatakit } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import type { TranscriptionSegment } from '@katakit/transcription';

/** The capture source supplies IDs scoped to a session. Only accepted turns enter the demo history. */
export const createTranscriptInput = () => {
  const turnSilenceMs = 1400;
  const transcript = makeTranscriptIngestionPlugin({ turnSilenceMs });
  const kit = makeKatakit({ plugins: [transcript.configure({})] }).start();
  const input = kit.getMethods(transcript);
  const views = kit.getObservables(transcript);
  const seen = new Set<string>();
  let previous: TranscriptionSegment | undefined;
  let closed = false;
  const flush = () => {
    if (closed) return;
    input.flush();
    if (views.provisionalUtterance$.get()?.text)
      input.updateProvisionalUtterance({ speaker: 'input', text: '' });
  };
  return {
    views,
    ingestSegment: (segment: TranscriptionSegment) => {
      const text = segment.text.trim();
      const id = JSON.stringify([segment.sourceId, segment.id]);
      if (closed || !text || seen.has(id)) return;
      seen.add(id);
      if (
        previous &&
        (previous.sourceId !== segment.sourceId ||
          (segment.startMs !== undefined &&
            previous.endMs !== undefined &&
            segment.startMs - previous.endMs > turnSilenceMs))
      )
        input.flush();
      previous = segment;
      input.ingestUtterance({
        id,
        speaker: segment.sourceId,
        text,
        startMs: segment.startMs ?? 0,
        endMs: segment.endMs ?? segment.startMs ?? 0,
      });
    },
    updateProvisional: (text: string) => {
      if (!closed) input.updateProvisionalUtterance({ text, speaker: 'input' });
    },
    flush,
    close: () => {
      closed = true;
      input.close();
    },
  };
};
