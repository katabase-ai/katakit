import { bind, Subscribe } from '@react-rxjs/core';
import { combineLatest } from 'rxjs';
import { useEffect, useState } from 'react';
import { makeKatakit } from '@katakit/core';
import {
  bingoPacks,
  defaultSquares,
  drawBingoPack,
  makeBingoPlugin,
  type BingoBoard,
  type BingoPackId,
} from './bingo';
import {
  makeTranscriptIngestionPlugin,
  type TranscriptSegment,
} from '@katakit/transcript-ingestion';
import { AudioLevelMeter } from './AudioLevelMeter';

const transcriptIngestion = makeTranscriptIngestionPlugin();
const bingo = makeBingoPlugin({ TranscriptIngestionPlugin: transcriptIngestion });
const kit = makeKatakit({ plugins: [transcriptIngestion.configure({}), bingo.configure({})] });
const running = kit.start();
const methods = running.getMethods(transcriptIngestion);
const bingoMethods = running.getMethods(bingo);
const { lastHeard$ } = kit.getObservables(transcriptIngestion);
const board$ = kit.getObservables(bingo).state$;
const [useLastHeard, lastHeardState$] = bind(lastHeard$);
const [useBoard, boardState$] = bind(board$);
const view$ = combineLatest([lastHeardState$, boardState$]);

type Phase = 'idle' | 'loading' | 'recording' | 'error';
type CaptureState = { phase: Phase; progress?: number; error?: string; micConnected?: boolean };

const BingoView = () => {
  const lastHeard = useLastHeard();
  const board = useBoard();
  const [capture, setCapture] = useState<CaptureState>({ phase: 'idle' });
  const [micLevel, setMicLevel] = useState(0);
  const [tabLevel, setTabLevel] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [packId, setPackId] = useState<BingoPackId | 'custom'>('meeting');
  const [customSquares, setCustomSquares] = useState([...defaultSquares]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    let transcriptVersion = 0;
    const listener = (message: {
      type?: string;
      segment?: TranscriptSegment;
      phase?: Phase;
      progress?: number;
      error?: string;
      micConnected?: boolean;
      source?: 'mic' | 'tab';
      level?: number;
    }) => {
      if (message.type === 'CAPTURE_RESET') {
        transcriptVersion++;
        methods.reset();
      }
      if (message.type === 'TRANSCRIPT_SEGMENT' && message.segment)
        methods.ingestSegment(message.segment);
      if (message.type === 'CAPTURE_LEVEL' && typeof message.level === 'number') {
        if (message.source === 'mic') setMicLevel(message.level);
        if (message.source === 'tab') setTabLevel(message.level);
      }
      if (message.type === 'CAPTURE_STATUS' && message.phase) {
        setCapture({
          phase: message.phase,
          progress: message.progress,
          error: message.error,
          micConnected: message.micConnected,
        });
        if (message.phase === 'idle') methods.flush();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    void (async () => {
      try {
        const initialTranscriptVersion = transcriptVersion;
        const [local, session] = await Promise.all([
          chrome.storage.local.get(['board', 'packId', 'customSquares']),
          chrome.storage.session.get(['segments', 'capture']),
        ]);
        if (!mounted) return;
        const storedBoard = local.board as BingoBoard | undefined;
        if (storedBoard?.squares?.length === 25) {
          try {
            bingoMethods.restoreBoard(storedBoard);
            const savedPack = local.packId;
            if (savedPack === 'custom' || bingoPacks.some(pack => pack.id === savedPack))
              setPackId(savedPack as BingoPackId | 'custom');
            else if (storedBoard.squares.some((phrase, index) => phrase !== defaultSquares[index]))
              setPackId('custom');
            if (Array.isArray(local.customSquares) && local.customSquares.length === 25)
              setCustomSquares(local.customSquares as string[]);
            else if (!savedPack || savedPack === 'custom')
              setCustomSquares([...storedBoard.squares]);
          } catch {
            // Keep the default card if saved settings were from an incompatible version.
          }
        }
        if (initialTranscriptVersion === transcriptVersion) {
          for (const segment of (session.segments ?? []) as TranscriptSegment[])
            methods.ingestSegment(segment);
          if (session.capture) setCapture(session.capture as CaptureState);
        }
      } catch {
        // A new install without stored state still has a playable default card.
      } finally {
        if (mounted) setLoaded(true);
      }
    })();
    return () => {
      mounted = false;
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    if (loaded)
      void chrome.storage.local.set({
        board: { squares: board.squares, overrides: board.overrides } satisfies BingoBoard,
        packId,
        customSquares,
      });
  }, [board.squares, board.overrides, packId, customSquares, loaded]);

  const { squares, evidence, marked, winningLines: wins } = board;
  const count = marked.filter(Boolean).length - 1;

  const toggleCapture = async () => {
    setBusy(true);
    try {
      const result = await chrome.runtime.sendMessage({
        type: capture.phase === 'recording' ? 'STOP_CAPTURE' : 'START_CAPTURE',
      });
      if (!result?.ok) setCapture({ phase: 'error', error: result?.error || 'Capture failed.' });
    } catch (error) {
      setCapture({ phase: 'error', error: String(error) });
    } finally {
      setBusy(false);
    }
  };

  const choosePack = (next: BingoPackId | 'custom') => {
    if (next === packId) return;
    bingoMethods.setSquares(next === 'custom' ? customSquares : drawBingoPack(next));
    setPackId(next);
  };
  const hasSavedCustomCard =
    packId === 'custom' || customSquares.some((phrase, index) => phrase !== defaultSquares[index]);

  return (
    <main className="panel">
      <header className="masthead">
        <div>
          <h1>Conversation bingo</h1>
          <p>Hear a phrase. Claim a square.</p>
        </div>
      </header>
      <section className="play" aria-label="Bingo board">
        <div className="board-head">
          <strong>{wins.length ? 'Bingo!' : `${count} of 24 squares`}</strong>
          <span>
            {wins.length
              ? `${wins.length} line${wins.length === 1 ? '' : 's'} complete`
              : 'Five in a row wins'}
          </span>
        </div>
        <div className="board" role="group" aria-label="Click squares to mark or correct them">
          {squares.map((phrase, index) => (
            <button
              key={index}
              type="button"
              className="square"
              data-marked={marked[index]}
              data-free={index === 12}
              data-long={phrase.length > 22}
              aria-pressed={marked[index]}
              title={
                evidence[index]
                  ? `Heard: ${evidence[index]}`
                  : phrase.length > 22
                    ? phrase
                    : undefined
              }
              onClick={() => {
                if (index !== 12) bingoMethods.setOverride(index, !marked[index]);
              }}
            >
              <span>{phrase}</span>
              {evidence[index] && marked[index] && <span className="heard">Heard</span>}
            </button>
          ))}
        </div>
      </section>
      <section className="pack-picker" aria-label="Bingo word list">
        <label htmlFor="bingo-pack">Word list</label>
        <div>
          <span className="pack-select">
            <select
              id="bingo-pack"
              value={packId}
              onChange={event => choosePack(event.target.value as BingoPackId | 'custom')}
            >
              {bingoPacks.map(pack => (
                <option key={pack.id} value={pack.id}>
                  {pack.label}
                </option>
              ))}
              {hasSavedCustomCard && <option value="custom">Saved custom card</option>}
            </select>
          </span>
          {packId !== 'custom' && (
            <button
              className="quiet"
              onClick={() => bingoMethods.setSquares(drawBingoPack(packId))}
            >
              Shuffle
            </button>
          )}
        </div>
      </section>
      <section className="capture" aria-label="Conversation capture">
        <div className="capture-head">
          <h2>Listen to your call</h2>
          <span role="status">
            {capture.phase === 'recording'
              ? capture.micConnected
                ? 'Tab and mic'
                : 'Tab only'
              : capture.phase === 'loading'
                ? 'Loading model'
                : 'Not listening'}
          </span>
        </div>
        <p>
          Start on a browser meeting tab. Moonshine Tiny streams English speech on this device; the
          first run downloads a model.
        </p>
        <button
          className="primary"
          disabled={busy || capture.phase === 'loading'}
          onClick={() => void toggleCapture()}
        >
          {busy ? 'Working…' : capture.phase === 'recording' ? 'Stop listening' : 'Start listening'}
        </button>
        <AudioLevelMeter
          active={capture.phase === 'recording'}
          level={capture.micConnected ? micLevel : tabLevel}
          label={capture.micConnected ? 'Microphone' : 'Tab audio'}
        />
        {capture.phase === 'loading' && (
          <p role="status">
            Preparing transcription
            {capture.progress === undefined ? '…' : `: ${Math.round(capture.progress * 100)}%`}
          </p>
        )}
        {capture.error && (
          <p className="error" role="alert">
            {capture.error}
          </p>
        )}
      </section>
      <section className="heard-list" aria-label="Transcript">
        <h2>Last heard</h2>
        <p aria-live="polite">{lastHeard || 'The transcript will appear here as you speak.'}</p>
      </section>
    </main>
  );
};

export const Bingo = () => (
  <Subscribe source$={view$}>
    <BingoView />
  </Subscribe>
);
