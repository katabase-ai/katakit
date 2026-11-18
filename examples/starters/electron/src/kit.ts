import { makeKatakit } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';

export const createTranscriptSession = () => {
  const Transcript = makeTranscriptIngestionPlugin();
  const kit = makeKatakit({ plugins: [Transcript.configure({})] });
  const methods = kit.start().getMethods(Transcript);
  const { conversationTurns$, currentTurn$, provisional$ } = kit.getObservables(Transcript);
  return {
    conversationTurns$,
    currentTurn$,
    provisional$,
    onProvisional: methods.updateProvisional,
    onFinal: methods.ingestSegment,
    onStop: methods.flush,
    close: methods.close,
  };
};
