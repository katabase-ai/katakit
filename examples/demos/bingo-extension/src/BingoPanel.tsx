import { useEffect, useState } from 'react';
import { createBingoSession } from './bingo/createBingoSession';
import { useBingoValue } from './bingo/useBingoValue';
import {
  bingoPacks,
  defaultSquares,
  drawBingoPack,
  type BingoBoard,
  type BingoPackId,
} from './bingo';
import type { TranscriptionSegment } from '@katakit/transcription';
import { AudioLevelMeter } from './AudioLevelMeter';

type Phase = 'idle' | 'loading' | 'recording' | 'error';
type CaptureState = { phase: Phase; progress?: number; error?: string; micConnected?: boolean };

const BingoView = ({ game }: { game: ReturnType<typeof createBingoSession> }) => {
  const transcript = useBingoValue(game.transcript$);
  const lastHeard = transcript.pending?.text ?? transcript.completed.at(-1)?.text;
  const board = useBingoValue(game.board$);
  const [capture, setCapture] = useState<CaptureState>({ phase: 'idle' });
  const [micLevel, setMicLevel] = useState(0);
  const [tabLevel, setTabLevel] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [packId, setPackId] = useState<BingoPackId | 'custom'>('meeting');
  const [customSquares, setCustomSquares] = useState([...defaultSquares]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    let ready = false;
    let resetDuringLoad = false;
    const queued: (() => void)[] = [];
    const deliver = (action: () => void) => {
      if (ready) action();
      else queued.push(action);
    };
    const listener = (message: {
      type?: string;
      segment?: TranscriptionSegment;
      phase?: Phase;
      progress?: number;
      error?: string;
      micConnected?: boolean;
      source?: 'mic' | 'tab';
      level?: number;
    }) => {
      if (message.type === 'CAPTURE_RESET') {
        resetDuringLoad = true;
        queued.length = 0;
        deliver(() => {
          const { squares, overrides } = game.board$.get();
          game.restart(squares, overrides);
        });
      }
      const segment = message.segment;
      if (message.type === 'TRANSCRIPT_SEGMENT' && segment)
        deliver(() => game.ingestSegment(segment));
      if (message.type === 'CAPTURE_LEVEL' && typeof message.level === 'number') {
        if (message.source === 'mic') setMicLevel(message.level);
        if (message.source === 'tab') setTabLevel(message.level);
      }
      if (message.type === 'CAPTURE_STATUS' && message.phase) {
        const phase = message.phase;
        deliver(() =>
          setCapture({
            phase,
            progress: message.progress,
            error: message.error,
            micConnected: message.micConnected,
          })
        );
        if (phase === 'idle') deliver(game.flush);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    void (async () => {
      try {
        const [local, session] = await Promise.all([
          chrome.storage.local.get(['board', 'packId', 'customSquares']),
          chrome.storage.session.get(['segments', 'capture']),
        ]);
        if (!mounted) return;
        const storedBoard = local.board as BingoBoard | undefined;
        if (storedBoard?.squares?.length === 25) {
          try {
            game.restart(storedBoard.squares, storedBoard.overrides);
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
        if (!resetDuringLoad) {
          for (const segment of (session.segments ?? []) as TranscriptionSegment[])
            game.ingestSegment(segment);
          if ((session.capture as CaptureState | undefined)?.phase === 'idle') game.flush();
          if (session.capture) setCapture(session.capture as CaptureState);
        }
      } catch {
        // A new install without stored state still has a playable default card.
      } finally {
        if (mounted) {
          ready = true;
          queued.forEach(action => action());
          queued.length = 0;
          setLoaded(true);
        }
      }
    })();
    return () => {
      mounted = false;
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [game]);

  useEffect(() => {
    if (loaded)
      void chrome.storage.local.set({
        board: { squares: board.squares, overrides: board.overrides } satisfies BingoBoard,
        packId,
        customSquares,
      });
  }, [board.squares, board.overrides, packId, customSquares, loaded]);

  const { squares, spoken, marked, winningLines: wins } = board;
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

  const restart = (squares: string[]) => {
    game.restart(squares);
    void chrome.runtime.sendMessage({ type: 'BINGO_NEW_ROUND' });
  };
  const choosePack = (next: BingoPackId | 'custom') => {
    if (next === packId) return;
    restart(next === 'custom' ? customSquares : drawBingoPack(next));
    setPackId(next);
  };
  const hasSavedCustomCard =
    packId === 'custom' || customSquares.some((phrase, index) => phrase !== defaultSquares[index]);

  if (!loaded) return <p role="status">Preparing bingo…</p>;
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
              title={spoken[index] ? `Heard: ${phrase}` : phrase.length > 22 ? phrase : undefined}
              onClick={() => {
                if (index !== 12) game.changeSquare(index, !marked[index]);
              }}
            >
              <span>{phrase}</span>
              {spoken[index] && marked[index] && <span className="heard">Heard</span>}
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
            <button className="quiet" onClick={() => restart(drawBingoPack(packId))}>
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

export const Bingo = () => {
  const [game, setGame] = useState<ReturnType<typeof createBingoSession>>();
  useEffect(() => {
    const session = createBingoSession();
    setGame(session);
    return session.close;
  }, []);
  return game ? <BingoView game={game} /> : null;
};
