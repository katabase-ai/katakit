import { useEffect, useState, type ReactNode } from 'react';
import type { createTranscriptionDemo } from './createTranscriptionDemo';
import './style.css';

const formatTime = (ms?: number) => {
  if (ms === undefined) return undefined;
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

/** Instance-owned presentation; the caller supplies capture controls and releases the runtime. */
export const TranscriptionDemo = ({
  runtime,
  controls,
  introduction,
  afterFirstSpeech,
  showIntroduction = true,
}: {
  runtime: ReturnType<typeof createTranscriptionDemo>;
  controls?: ReactNode;
  introduction?: ReactNode;
  afterFirstSpeech?: ReactNode;
  /** Embedded hosts can supply their own page header. Standalone introductions remain the default. */
  showIntroduction?: boolean;
}) => {
  const [snapshot, setSnapshot] = useState(() => runtime.state$.getValue());
  useEffect(() => {
    const subscription = runtime.state$.subscribe(setSnapshot);
    return () => subscription.unsubscribe();
  }, [runtime]);
  const { completedTurns, currentTurn, provisional } = snapshot;
  const turns = currentTurn ? [...completedTurns, currentTurn] : completedTurns;
  return (
    <section
      className="workspace transcription-demo"
      aria-labelledby={showIntroduction ? 'title' : undefined}
      aria-label={showIntroduction ? undefined : 'Local transcription'}
    >
      {showIntroduction && (
        <div className="intro">
          {introduction ?? (
            <>
              <h1 id="title">Conversation, in text.</h1>
              <p>Record in your browser. Read each conversation turn as it finishes.</p>
            </>
          )}
        </div>
      )}

      {controls}

      <section className="transcript" aria-labelledby="transcript-heading">
        <div className="transcript-heading">
          <h2 id="transcript-heading">Transcript</h2>
          <span>{completedTurns.length} completed turns</span>
        </div>

        {!turns.length && !provisional ? (
          <div className="empty-state">
            <p>Your conversation will appear here.</p>
            <span>Speak naturally; short transcript fragments will be grouped into turns.</span>
          </div>
        ) : (
          <div className="turn-list" aria-live="polite" aria-relevant="additions text">
            {turns.map((turn, index) => (
              <article className="turn" key={turn.id}>
                <span className="turn-index">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <p>{turn.text}</p>
                  {turn === currentTurn && <span className="working">Turn in progress</span>}
                </div>
                <time>{formatTime(turn.startMs)}</time>
              </article>
            ))}
            {provisional && (
              <div className="turn interim">
                <span className="turn-index">··</span>
                <p>{provisional}</p>
                <span className="working">Listening</span>
              </div>
            )}
          </div>
        )}
      </section>
      {(turns.length > 0 || Boolean(provisional)) && afterFirstSpeech}
      <footer>
        English-only models. Audio stays in this browser. Leaving this demo clears its transcript.
      </footer>
    </section>
  );
};
