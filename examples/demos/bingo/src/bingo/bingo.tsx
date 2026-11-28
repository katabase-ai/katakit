import { use, useState, type ReactNode } from 'react';
import { SelectField } from '../ui/controls';
import { useBingoKatakit } from './useBingoKatakit';
import { TranscriptTurns } from '../ui/TranscriptTurns';
import './style.css';
import {
  MicrophoneTranscriberContext,
  useMicrophoneTranscriberCallbacks,
} from '@katakit/transcription/react';
import { BingoPlugin } from './plugin';
import { BingoWordListId, wordLists, drawBingoWordList } from './wordLists';

export const Bingo = ({
  controls,
  showIntroduction = true,
}: {
  controls?: ReactNode;
  /** Embedded hosts can supply their own page header. */
  showIntroduction?: boolean;
}) => {
  const [wordList, setWordList] = useState<{ id: BingoWordListId; squares: string[] }>({
    id: wordLists[0].id,
    squares: drawBingoWordList(wordLists[0].id),
  });

  return (
    <BingoKatakitWrapper
      key={wordList.id}
      squares={wordList.squares}
      controls={controls}
      showIntroduction={showIntroduction}
      wordListPicker={
        <WordListPicker
          value={wordList.id}
          onChange={id => setWordList({ id, squares: drawBingoWordList(id) })}
        />
      }
    />
  );
};

const BingoKatakitWrapper = ({
  squares,
  controls,
  showIntroduction,
  wordListPicker,
}: {
  squares: string[];
  controls?: ReactNode;
  showIntroduction?: boolean;
  wordListPicker: ReactNode;
}) => {
  const bingoKatakit = useBingoKatakit(squares);

  if (!bingoKatakit) return null;

  return (
    <BingoBody
      bingoKatakit={bingoKatakit}
      controls={controls}
      showIntroduction={showIntroduction}
      wordListPicker={wordListPicker}
    />
  );
};

const WordListPicker = ({
  value,
  onChange,
}: {
  value: BingoWordListId;
  onChange: (next: BingoWordListId) => void;
}) => {
  return (
    <div className="bingo-word-list-picker">
      <SelectField
        id="bingo-word-list"
        label="Word list"
        value={value}
        onChange={event => {
          const wordList = event.target.value as BingoWordListId;
          if (wordList === value) return;
          onChange(wordList);
        }}
      >
        {wordLists.map(wordList => (
          <option key={wordList.id} value={wordList.id}>
            {wordList.label}
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
  wordListPicker,
}: {
  bingoKatakit: NonNullable<ReturnType<typeof useBingoKatakit>>;
  controls?: ReactNode;
  showIntroduction?: boolean;
  wordListPicker: ReactNode;
}) => {
  const squares = bingoKatakit.useSquares();
  const marked = bingoKatakit.useMarked();
  const winningLines = bingoKatakit.useWinningLanes();
  const completed = bingoKatakit.useCollectedConversationTurns();
  const current = bingoKatakit.usePendingConversationTurn();
  const provisional = bingoKatakit.useProvisionalUtterance();

  const microphone = use(MicrophoneTranscriberContext);
  if (!microphone) {
    throw new Error('MicrophoneTranscriberContext is not available');
  }

  useMicrophoneTranscriberCallbacks(microphone, {
    onUtterance: bingoKatakit.ingestUtterance,
    onProvisionalUtterance: bingoKatakit.updateProvisionalUtterance,
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
            <strong>
              {winningLines.length ? 'Bingo!' : `${markedCount} of ${squares.length} squares`}
            </strong>
            {winningLines.length > 0 && (
              <span>
                {`${winningLines.length} line${winningLines.length === 1 ? '' : 's'} complete`}
              </span>
            )}
            {wordListPicker}
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
                onClick={() => {
                  bingoKatakit.katakit.getMethods(BingoPlugin).changeSquare(index, !marked[index]);
                }}
              >
                {phrase}
              </button>
            ))}
          </div>
        </section>
        <aside className="bingo-controls" aria-label="Bingo transcript and controls">
          {controls}
          <TranscriptTurns
            completed={completed}
            current={current ?? undefined}
            provisional={provisional?.text}
          />
        </aside>
      </div>
    </section>
  );
};
