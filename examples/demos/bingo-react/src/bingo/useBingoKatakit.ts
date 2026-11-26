import { makeKatakit } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import type { TranscriptionSegment } from '@katakit/transcription';
import { BingoPlugin } from './plugin';
import { useKatakitInit } from '@katakit/react';
import { useEffect, useMemo, useState } from 'react';
import { bind } from '@react-rxjs/core';

const turnSilenceMs = 1400;

/**
 * TODO: this uses wrong patterns
 */
export const useBingoKatakit = (squares: string[]) => {
  const [TranscriptIngestionPlugin] = useState(() =>
    makeTranscriptIngestionPlugin({ turnSilenceMs })
  );
  const katakit = useKatakitInit(
    () =>
      makeKatakit({
        plugins: [
          TranscriptIngestionPlugin.configure({}),
          BingoPlugin.configure({ TranscriptIngestionPlugin }),
        ],
      }),
    katakit => {
      katakit.getMethods(TranscriptIngestionPlugin).flush();
      katakit.getMethods(TranscriptIngestionPlugin).close();
    }
  );

  useEffect(() => {
    if (!katakit) return;
    katakit.getMethods(BingoPlugin).startGame(squares);
  }, [katakit]);

  return useMemo(
    () =>
      katakit
        ? ({
            katakit,
            ingestUtterance: (utterance: TranscriptionSegment) => {
              katakit.getMethods(TranscriptIngestionPlugin).ingestUtterance({
                id: utterance.id,
                text: utterance.text,
                speaker: 'microphone',
                startMs: utterance.startMs ?? 0,
                endMs: utterance.endMs ?? utterance.startMs ?? 0,
              });
            },
            ingestSegment: (utterance: TranscriptionSegment) => {
              katakit.getMethods(TranscriptIngestionPlugin).ingestUtterance({
                id: utterance.id,
                text: utterance.text,
                speaker: 'microphone',
                startMs: utterance.startMs ?? 0,
                endMs: utterance.endMs ?? utterance.startMs ?? 0,
              });
            },
            updateProvisionalUtterance: (text: string) =>
              katakit
                .getMethods(TranscriptIngestionPlugin)
                .updateProvisionalUtterance({ text, speaker: 'microphone' }),
            flush: katakit.getMethods(TranscriptIngestionPlugin).flush,
            close: katakit.getMethods(TranscriptIngestionPlugin).close,
            // TODO: all this below is wrong
            useSquares: bind(
              katakit.getObservables(BingoPlugin).squares$,
              katakit.getObservables(BingoPlugin).squares$.get()
            )[0],
            useWinningLanes: bind(
              katakit.getObservables(BingoPlugin).winningLanes$,
              katakit.getObservables(BingoPlugin).winningLanes$.get()
            )[0],
            useMarked: bind(
              katakit.getObservables(BingoPlugin).marked$,
              katakit.getObservables(BingoPlugin).marked$.get()
            )[0],
            useCollectedConversationTurns: bind(
              katakit.getObservables(TranscriptIngestionPlugin).collectedConversationTurns$,
              katakit.getObservables(TranscriptIngestionPlugin).collectedConversationTurns$.get()
            )[0],
            usePendingConversationTurn: bind(
              katakit.getObservables(TranscriptIngestionPlugin).pendingConversationTurn$,
              katakit.getObservables(TranscriptIngestionPlugin).pendingConversationTurn$.get()
            )[0],
            useProvisionalUtterance: bind(
              katakit.getObservables(TranscriptIngestionPlugin).provisionalUtterance$,
              katakit.getObservables(TranscriptIngestionPlugin).provisionalUtterance$.get()
            )[0],
          } as const)
        : null,
    [katakit]
  );
};
