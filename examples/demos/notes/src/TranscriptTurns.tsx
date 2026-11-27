import { useEffect, useState, type ReactNode } from 'react';
import type { TranscriptionSegment } from '@katakit/transcription';
import { combineLatest, type Observable } from 'rxjs';

type PendingTurn = Pick<TranscriptionSegment, 'text' | 'startMs'>;

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
  transcript,
  children,
}: {
  /** The transcript ingestion plugin's observables. */
  transcript: {
    conversationTurns$: Observable<TranscriptionSegment[]>;
    currentTurn$: Observable<PendingTurn | undefined>;
    provisional$: Observable<string | undefined>;
  };
  /** A short note about the transcript, shown beneath its turns. */
  children?: ReactNode;
}) => {
  const [state, setState] = useState<{
    turns: (TranscriptionSegment | PendingTurn)[];
    provisional?: string;
  }>({ turns: [] });
  useEffect(() => {
    const subscription = combineLatest([
      transcript.conversationTurns$,
      transcript.currentTurn$,
      transcript.provisional$,
    ]).subscribe(([completed, current, provisional]) =>
      setState({ turns: current ? [...completed, current] : completed, provisional })
    );
    return () => subscription.unsubscribe();
  }, [transcript]);
  const { turns, provisional } = state;
  return (
    <aside className="transcript-turns" aria-label="Transcript">
      <h2>Transcript</h2>
      <div className="transcript-turns-list" aria-live="polite" aria-relevant="additions text">
        {provisional && (
          <article className="transcript-turn" data-interim="true">
            <span className="transcript-turn-index">··</span>
            <p>{provisional}</p>
          </article>
        )}
        {turns
          .map((turn, index) => ({ turn, number: index + 1 }))
          .toReversed()
          .map(({ turn, number }) => (
            <article className="transcript-turn" key={'id' in turn ? String(turn.id) : 'pending'}>
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
