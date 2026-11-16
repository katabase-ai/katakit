import { useEffect, useState, type ReactNode } from 'react';
import { bingoPacks, drawBingoPack, type BingoPackId } from './bingo';
import { Button, SelectField } from './controls';
import type { createBrowserBingoDemo } from './createBrowserBingoDemo';
import './style.css';

export const BrowserBingoDemo = ({
  runtime,
  controls,
}: {
  runtime: ReturnType<typeof createBrowserBingoDemo>;
  controls: ReactNode;
}) => {
  const [snapshot, setSnapshot] = useState(() => runtime.state$.getValue());
  const [packId, setPackId] = useState<BingoPackId>('meeting');
  useEffect(() => {
    const subscription = runtime.state$.subscribe(setSnapshot);
    return () => subscription.unsubscribe();
  }, [runtime]);
  const { board, lastHeard } = snapshot;
  const markedCount = board.marked.filter(Boolean).length - 1;
  const bingoMethods = runtime.bingoMethods;
  const choosePack = (next: BingoPackId) => {
    if (next === packId) return;
    bingoMethods.setSquares(drawBingoPack(next));
    setPackId(next);
  };
  return (
    <section className="browser-bingo" aria-labelledby="bingo-title">
      <header className="bingo-intro">
        <div>
          <h1 id="bingo-title">Conversation bingo</h1>
          <p>Say it in the conversation. See it on the card.</p>
        </div>
      </header>
      <div className="bingo-layout">
        <section className="bingo-game" aria-label="Bingo card">
          <div className="bingo-score">
            <strong>{board.winningLines.length ? 'Bingo!' : `${markedCount} of 24 squares`}</strong>
            <span>
              {board.winningLines.length
                ? `${board.winningLines.length} line${board.winningLines.length === 1 ? '' : 's'} complete`
                : 'Five in a row wins'}
            </span>
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
        <aside className="bingo-controls" aria-label="Conversation input">
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
            <Button variant="ghost" onClick={() => bingoMethods.setSquares(drawBingoPack(packId))}>
              Shuffle
            </Button>
          </div>
          {controls}
          <div className="bingo-transcript">
            <h2>Last heard</h2>
            <p aria-live="polite">{lastHeard || 'Your conversation will appear here.'}</p>
          </div>
        </aside>
      </div>
    </section>
  );
};
