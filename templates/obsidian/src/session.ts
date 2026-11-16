import { makeKatakit } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';

/** One in-memory Katakit instance per view. No microphone or vault persistence. */
export const createTextSession = () => {
  const transcription = makeTranscriptIngestionPlugin();
  const kit = makeKatakit({ plugins: [transcription.configure({})] });
  const methods = kit.start().getMethods(transcription);
  const { conversationTurns$, currentTurn$ } = kit.getObservables(transcription);
  let nextId = 0;

  return {
    conversationTurns$,
    currentTurn$,
    submit(text: string) {
      if (!text.trim()) throw new Error('Enter text before adding a line.');
      methods.ingestSegment({ id: String(++nextId), sourceId: 'typed-text', text });
      methods.flush();
    },
    close: () => methods.close(),
  };
};
