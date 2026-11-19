import { useEffect, useState, type ReactNode } from 'react';
import { bingoPacks, drawBingoPack, type BingoPackId } from './bingo';
import { Button, SelectField } from './controls';
import type { createBrowserBingoDemo } from './createBrowserBingoDemo';
import { TranscriptTurns } from './TranscriptTurns';
import './style.css';

export const BrowserBingoDemo = ({
  runtime,
  controls,
  showIntroduction = true,
}: {
  runtime: ReturnType<typeof createBrowserBingoDemo>;
  controls?: ReactNode;
  /** Embedded hosts can supply their own page header. */
  showIntroduction?: boolean;
}) => {
  const [snapshot, setSnapshot] = useState(() => runtime.state$.getValue());
  const [packId, setPackId] = useState<BingoPackId>('meeting');
  useEffect(() => {
    const subscription = runtime.state$.subscribe(setSnapshot);
    return () => subscription.unsubscribe();
  }, [runtime]);
  const { board } = snapshot;
  const markedCount = board.marked.filter(Boolean).length - 1;
  const bingoMethods = runtime.bingoMethods;
  const choosePack = (next: BingoPackId) => {
    if (next === packId) return;
    bingoMethods.setSquares(drawBingoPack(next));
    setPackId(next);
  };
  const packPicker = (
    <div className="bingo-pack-picker">
      <SelectField
        id="bingo-pack"
        label="Word list"
        value={packId}
        onChange={event => choosePack(event.target.value as BingoPackId)}
      >
        {bingoPacks.map(pack => (
          <option key={pack.id} value={pack.id}>
            {pack.label}
          </option>
        ))}
      </SelectField>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Shuffle"
        title="Shuffle"
        onClick={() => bingoMethods.setSquares(drawBingoPack(packId))}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m18 14 4 4-4 4" />
          <path d="m18 2 4 4-4 4" />
          <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" />
          <path d="M2 6h1.972a4 4 0 0 1 3.6 2.2" />
          <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />
        </svg>
      </Button>
    </div>
  );
  return (
    <section
      className="browser-bingo"
      aria-labelledby={showIntroduction ? 'bingo-title' : undefined}
      aria-label={showIntroduction ? undefined : 'Conversation bingo'}
    >
      {showIntroduction && (
        <header className="bingo-intro">
          <div>
            <h1 id="bingo-title">Conversation bingo</h1>
            <p>Say it in the conversation. See it on the card. Five in a row wins!</p>
          </div>
        </header>
      )}
      <div className="bingo-layout">
        <section className="bingo-game" aria-label="Bingo card">
          <div className="bingo-score" role="status" aria-atomic="true">
            <strong>{board.winningLines.length ? 'Bingo!' : `${markedCount} of 24 squares`}</strong>
            {board.winningLines.length > 0 && (
              <span>
                {`${board.winningLines.length} line${board.winningLines.length === 1 ? '' : 's'} complete`}
              </span>
            )}
            {packPicker}
          </div>
          <div
            className="bingo-grid"
            role="group"
            aria-label="Click squares to mark or correct them"
          >
            {board.squares.map((phrase, index) => (
              <button
                className="bingo-square"
                key={index}
                type="button"
                data-marked={board.marked[index]}
                data-free={index === 12}
                data-long={phrase.length > 22}
                aria-pressed={board.marked[index]}
                aria-disabled={index === 12}
                aria-label={`${phrase}${board.evidence[index] ? `, heard: ${board.evidence[index]}` : ''}`}
                title={
                  board.evidence[index]
                    ? `Heard: ${board.evidence[index]}`
                    : phrase.length > 22
                      ? phrase
                      : undefined
                }
                onClick={() => {
                  if (index !== 12) bingoMethods.setOverride(index, !board.marked[index]);
                }}
              >
                {phrase}
              </button>
            ))}
          </div>
        </section>
        <aside className="bingo-controls" aria-label="Bingo controls">
          {controls}
          <p>
            Select a square to mark or correct it. Shuffle and word-list changes clear manual marks;
            phrases already heard can still match.
          </p>
          <TranscriptTurns transcript={runtime.transcript} />
        </aside>
      </div>
      <p>Stopping keeps this card. Leaving this demo or reloading starts a fresh card.</p>
    </section>
  );
};
