import { use, useState, type ReactNode } from 'react';
import { SelectField } from './controls';
import { useBingoKatakit } from './bingo/useBingoKatakit';
import { TranscriptTurns } from './TranscriptTurns';
import './style.css';
import {
  MicrophoneTranscriberContext,
  useMicrophoneTranscriberCallbacks,
} from '@katakit/transcription/react';
import { BingoPlugin } from './bingo/plugin';
import { BingoPackId, bingoPacks, drawBingoPack } from './bingo/packs';

export const BrowserBingoDemo = ({
  controls,
  showIntroduction = true,
}: {
  controls?: ReactNode;
  /** Embedded hosts can supply their own page header. */
  showIntroduction?: boolean;
}) => {
  const [pack, setPack] = useState<{ id: BingoPackId; squares: string[] }>({
    id: bingoPacks[0].id,
    squares: drawBingoPack(bingoPacks[0].id),
  });

  return (
    <BingoKatakitWrapper
      key={pack.id}
      squares={pack.squares}
      controls={controls}
      showIntroduction={showIntroduction}
      packPicker={
        <PackPicker value={pack.id} onChange={id => setPack({ id, squares: drawBingoPack(id) })} />
      }
    />
  );
};

const BingoKatakitWrapper = ({
  squares,
  controls,
  showIntroduction,
  packPicker,
}: {
  squares: string[];
  controls?: ReactNode;
  showIntroduction?: boolean;
  packPicker: ReactNode;
}) => {
  const bingoKatakit = useBingoKatakit(squares);

  if (!bingoKatakit) return null;

  return (
    <BingoBody
      bingoKatakit={bingoKatakit}
      controls={controls}
      showIntroduction={showIntroduction}
      packPicker={packPicker}
    />
  );
};

const PackPicker = ({
  value,
  onChange,
}: {
  value: BingoPackId;
  onChange: (next: BingoPackId) => void;
}) => {
  return (
    <div className="bingo-pack-picker">
      <SelectField
        id="bingo-pack"
        label="Word list"
        value={value}
        onChange={event => {
          const pack = event.target.value as BingoPackId;
          if (pack === value) return;
          onChange(pack);
        }}
      >
        {bingoPacks.map(pack => (
          <option key={pack.id} value={pack.id}>
            {pack.label}
          </option>
        ))}
      </SelectField>
    </div>
  );
};

const BingoBody = ({
  bingoKatakit,
  controls,
  showIntroduction,
  packPicker,
}: {
  bingoKatakit: NonNullable<ReturnType<typeof useBingoKatakit>>;
  controls?: ReactNode;
  showIntroduction?: boolean;
  packPicker: ReactNode;
}) => {
  const squares = bingoKatakit.useSquares();
  const marked = bingoKatakit.useMarked();
  const winningLines = bingoKatakit.useWinningLanes();

  const microphone = use(MicrophoneTranscriberContext);
  if (!microphone) {
    throw new Error('MicrophoneTranscriberContext is not available');
  }

  useMicrophoneTranscriberCallbacks(microphone, {
    onUtterance: bingoKatakit.ingestUtterance,
    onProvisionalUtterance: provisionalUtterance =>
      bingoKatakit.updateProvisionalUtterance(provisionalUtterance.text),
    onFlush: bingoKatakit.flush,
    onClose: bingoKatakit.close,
  });

  if (!squares || !marked) return null;

  const markedCount = Object.values(marked).filter(Boolean).length;

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
          <div className="bingo-score">
            <strong>{winningLines.length ? 'Bingo!' : `${markedCount} of 24 squares`}</strong>
            {winningLines.length > 0 && (
              <span>
                {`${winningLines.length} line${winningLines.length === 1 ? '' : 's'} complete`}
              </span>
            )}
            {packPicker}
          </div>
          <div
            className="bingo-grid"
            role="group"
            aria-label="Click squares to mark or correct them"
          >
            {squares.map((phrase, index) => (
              <button
                className="bingo-square"
                key={index}
                type="button"
                data-marked={marked[index]}
                data-long={phrase.length > 22}
                aria-pressed={marked[index]}
                aria-disabled={index === 12}
                onClick={() => {
                  bingoKatakit.katakit.getMethods(BingoPlugin).changeSquare(index, !marked[index]);
                }}
              >
                {phrase}
              </button>
            ))}
          </div>
        </section>
        <aside className="bingo-controls" aria-label="Bingo controls">
          {controls}
          <TranscriptTurns bingoKatakit={bingoKatakit} />
        </aside>
      </div>
    </section>
  );
};
