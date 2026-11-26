import type { ReactNode } from 'react';
import { useBingoKatakit } from './bingo/useBingoKatakit';

const formatTime = (ms?: number) => {
  if (ms === undefined) return undefined;
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

/**
 * A thin column of the conversation so far, in the Local transcription demo's numbered-turn form
 * but newest first, with each turn's start time right-aligned beneath it. The structured-notes and
 * bingo examples each carry this file so either can be copied alone.
 */
export const TranscriptTurns = ({
  bingoKatakit,
  children,
}: {
  bingoKatakit: NonNullable<ReturnType<typeof useBingoKatakit>>;
  /** A short note about the transcript, shown beneath its turns. */
  children?: ReactNode;
}) => {
  const collectedConversationTurns = bingoKatakit.useCollectedConversationTurns();
  const pendingConversationTurn = bingoKatakit.usePendingConversationTurn();
  const provisionalUtterance = bingoKatakit.useProvisionalUtterance();

  const turns = pendingConversationTurn
    ? [...collectedConversationTurns, { ...pendingConversationTurn, id: 'pending' }]
    : collectedConversationTurns;
  return (
    <aside className="transcript-turns" aria-label="Transcript">
      <h2>Transcript</h2>
      <div className="transcript-turns-list" aria-live="polite" aria-relevant="additions text">
        {provisionalUtterance && (
          <article className="transcript-turn" data-interim="true">
            <span className="transcript-turn-index">··</span>
            <p>{provisionalUtterance.text}</p>
          </article>
        )}
        {turns
          .map((turn, index) => ({ turn, number: index + 1 }))
          .toReversed()
          .map(({ turn, number }) => (
            <article className="transcript-turn" key={turn.id}>
              <span className="transcript-turn-index">{String(number).padStart(2, '0')}</span>
              <p>{turn.text}</p>
              <time>{formatTime(turn.startMs)}</time>
            </article>
          ))}
      </div>
      {children}
    </aside>
  );
};
