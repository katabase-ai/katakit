import type { TranscriptTurn } from './extractionPlugin';
import { formatTime } from './extractionModel';

/** A local view of the already-bound transcript, matching the gallery's numbered-turn column. */
export const TranscriptTurns = ({
  turns,
  current,
  provisional,
}: {
  turns: readonly TranscriptTurn[];
  current?: Pick<TranscriptTurn, 'text' | 'startMs'>;
  provisional?: string;
}) => (
  <aside className="extraction-transcript" aria-label="Transcript">
    <h2>Transcript</h2>
    <div className="extraction-transcript-list" aria-live="polite" aria-relevant="additions text">
      {!turns.length && !current && !provisional && (
        <p className="extraction-hint">Your words will appear here…</p>
      )}
      {provisional && (
        <article className="extraction-transcript-turn" data-interim="true">
          <span className="extraction-transcript-index">··</span>
          <p>{provisional}</p>
        </article>
      )}
      {(current ? [...turns, current] : turns)
        .map((turn, index) => ({ turn, number: index + 1 }))
        .toReversed()
        .map(({ turn, number }) => (
          <article
            className="extraction-transcript-turn"
            key={'id' in turn ? String(turn.id) : 'pending'}
          >
            <span className="extraction-transcript-index">{String(number).padStart(2, '0')}</span>
            <p>{turn.text}</p>
            <time>{formatTime(turn.startMs)}</time>
          </article>
        ))}
    </div>
  </aside>
);
