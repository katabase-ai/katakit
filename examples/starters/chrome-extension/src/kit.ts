import { makeKatakit } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';

export const createTranscriptSession = () => {
  const Transcript = makeTranscriptIngestionPlugin();
  const kit = makeKatakit({ plugins: [Transcript.configure({})] });
  const methods = kit.start().getMethods(Transcript);
  const { conversationTurns$, currentTurn$ } = kit.getObservables(Transcript);
  return {
    conversationTurns$,
    currentTurn$,
    onFinal: methods.ingestSegment,
    onStop: methods.flush,
    clear: methods.reset,
    close: methods.close,
  };
};
