import { makeKatakit } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import type { TranscriptionSegment } from '@katakit/transcription';
import { BingoPlugin, type BingoBoard } from './plugin';
import { useKatakitInit } from '@katakit/react';
import { useEffect, useMemo, useState } from 'react';
import { bind } from '@react-rxjs/core';

const turnSilenceMs = 1400;

/**
 * TODO: this uses wrong patterns
 */
export const useBingoKatakit = (board: BingoBoard) => {
  const [TranscriptIngestionPlugin] = useState(() => makeTranscriptIngestionPlugin({ turnSilenceMs }));
  const katakit = useKatakitInit(() => makeKatakit({
    plugins: [TranscriptIngestionPlugin.configure({}), BingoPlugin.configure({})],
  }));

  useEffect(() => {
    if (!katakit) return;
    katakit.getMethods(BingoPlugin).startGame(board.squares);
  }, [katakit])

  if (!katakit) return null;

  return useMemo(() => ({
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
      katakit.getMethods(TranscriptIngestionPlugin).updateProvisionalUtterance({ text, speaker: 'microphone' }),
    flush: katakit.getMethods(TranscriptIngestionPlugin).flush,
    close: katakit.getMethods(TranscriptIngestionPlugin).close,
    useSquares: bind(katakit.getObservables(BingoPlugin).squares$),
    useWinningLanes: bind(katakit.getObservables(BingoPlugin).winningLanes$),
    useMarked: bind(katakit.getObservables(BingoPlugin).marked$),
  }), []);
};
