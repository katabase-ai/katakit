import { makeKatakit } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';

/** One in-memory Katakit instance per view. No microphone or vault persistence. */
export const createTextSession = () => {
  const transcription = makeTranscriptIngestionPlugin();
  const kit = makeKatakit({ plugins: [transcription.configure({})] });
  const methods = kit.start().getMethods(transcription);
  const { collectedConversationTurns$ } = kit.getObservables(transcription);
  let nextId = 0;

  return {
    turns$: collectedConversationTurns$,
    acceptRecognized(text: string, durationMs: number) {
      if (!text.trim()) throw new Error('No speech recognized. Try a shorter recording.');
      methods.ingestUtterance({
        id: String(++nextId),
        speaker: 'microphone',
        text: text.trim(),
        startMs: 0,
        endMs: durationMs,
      });
      methods.flush();
    },
    close: () => methods.close(),
  };
};
