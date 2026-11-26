import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { EventLogPlugin } from '@katakit/core';
import { bingoPacks, drawBingoPack, type BingoPackId } from './bingo/packs';
import { BingoPlugin } from './bingo/plugin';
import { useBingoKatakit } from './bingo/useBingoKatakit';
import {
  createPanelDeal,
  readSavedBoard,
  readSquares,
  type PanelGame,
  type SavedBoard,
} from './panelDeal';
import type { TranscriptionSegment } from '@katakit/transcription';
import { AudioLevelMeter } from './AudioLevelMeter';

type Phase = 'idle' | 'loading' | 'recording' | 'error';
type CaptureState = { phase: Phase; progress?: number; error?: string; micConnected?: boolean };

export const Bingo = () => {
  const [deal, setDeal] = useState(() =>
    createPanelDeal({ squares: drawBingoPack('meeting'), overrides: {} }, 0)
  );
  const current = useRef(deal);
  const replaceDeal = useCallback((board: SavedBoard) => {
    current.current = createPanelDeal(board, current.current.key + 1);
    setDeal(current.current);
  }, []);
  const [capture, setCapture] = useState<CaptureState>({ phase: 'idle' });
  const [micLevel, setMicLevel] = useState(0);
  const [tabLevel, setTabLevel] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [packId, setPackId] = useState<BingoPackId | 'custom'>('meeting');
  const [customSquares, setCustomSquares] = useState<string[]>();
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
          replaceDeal(current.current.savedBoard());
        });
      }
      const segment = message.segment;
      if (message.type === 'TRANSCRIPT_SEGMENT' && segment)
        deliver(() => current.current.deliver(segment));
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
        if (phase === 'idle') deliver(() => current.current.deliver('flush'));
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
        const storedBoard = readSavedBoard(local.board, local.packId);
        if (storedBoard) {
          replaceDeal(storedBoard);
          const savedPack = bingoPacks.find(pack => pack.id === local.packId)?.id ?? 'custom';
          setPackId(savedPack);
          setCustomSquares(
            readSquares(local.customSquares, 'custom') ??
              (savedPack === 'custom' ? storedBoard.squares : undefined)
          );
        }
        if (!resetDuringLoad) {
          for (const segment of (session.segments ?? []) as TranscriptionSegment[])
            current.current.deliver(segment);
          if ((session.capture as CaptureState | undefined)?.phase === 'idle')
            current.current.deliver('flush');
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
  }, [replaceDeal]);

  useEffect(() => {
    if (loaded)
      void chrome.storage.local.set({
        board: deal.savedBoard(),
        packId,
        ...(customSquares && { customSquares }),
      });
  }, [deal, packId, customSquares, loaded]);

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
    replaceDeal({ squares, overrides: {} });
    void chrome.runtime.sendMessage({ type: 'BINGO_NEW_ROUND' });
  };
  const choosePack = (next: BingoPackId | 'custom') => {
    if (next === packId || (next === 'custom' && !customSquares)) return;
    restart(next === 'custom' ? customSquares! : drawBingoPack(next));
    setPackId(next);
  };

  if (!loaded) return <p role="status">Preparing bingo…</p>;
  return (
    <main className="panel">
      <header className="masthead">
        <div>
          <h1>Conversation bingo</h1>
          <p>Hear a phrase. Claim a square.</p>
        </div>
      </header>
      <PanelRound key={deal.key} deal={deal}>
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
                {customSquares && <option value="custom">Saved custom card</option>}
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
            Start on a browser meeting tab. Moonshine Tiny streams English speech on this device;
            the first run downloads a model.
          </p>
          <button
            className="primary"
            disabled={busy || capture.phase === 'loading'}
            onClick={() => void toggleCapture()}
          >
            {busy
              ? 'Working…'
              : capture.phase === 'recording'
                ? 'Stop listening'
                : 'Start listening'}
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
      </PanelRound>
    </main>
  );
};

type Deal = ReturnType<typeof createPanelDeal>;

const PanelRound = ({ deal, children }: { deal: Deal; children: ReactNode }) => {
  const game = useBingoKatakit(deal.squares);
  useEffect(() => {
    if (game) return deal.attach(game);
  }, [deal, game]);
  return game ? (
    <PanelBoard game={game} deal={deal}>
      {children}
    </PanelBoard>
  ) : null;
};

const PanelBoard = ({
  game,
  deal,
  children,
}: {
  game: PanelGame;
  deal: Deal;
  children: ReactNode;
}) => {
  const marked = game.useMarked();
  const wins = game.useWinningLanes();
  const pending = game.usePendingConversationTurn();
  const completed = game.useCollectedConversationTurns();
  const heard = new Set(
    game.katakit
      .getObservables(EventLogPlugin)
      .events$.getAll()
      .filter(event => event.type === 'squareSpoken')
      .map(event => event.index)
  );
  if (!marked) return null;
  return (
    <>
      <section className="play" aria-label="Bingo board">
        <div className="board-head">
          <strong>
            {wins.length
              ? 'Bingo!'
              : `${Object.values(marked).filter(Boolean).length} of ${deal.squares.length} squares`}
          </strong>
          <span>
            {wins.length
              ? `${wins.length} line${wins.length === 1 ? '' : 's'} complete`
              : 'Five in a row wins'}
          </span>
        </div>
        <div className="board" role="group" aria-label="Click squares to mark or correct them">
          {deal.squares.map((phrase, index) => (
            <button
              key={index}
              type="button"
              className="square"
              data-marked={marked[index]}
              data-long={phrase.length > 22}
              aria-pressed={marked[index]}
              title={
                heard.has(index) ? `Heard: ${phrase}` : phrase.length > 22 ? phrase : undefined
              }
              onClick={() => {
                game.katakit.getMethods(BingoPlugin).changeSquare(index, !marked[index]);
                void chrome.storage.local.set({ board: deal.savedBoard() });
              }}
            >
              <span>{phrase}</span>
              {heard.has(index) && marked[index] && <span className="heard">Heard</span>}
            </button>
          ))}
        </div>
      </section>
      {children}
      <section className="heard-list" aria-label="Transcript">
        <h2>Last heard</h2>
        <p aria-live="polite">
          {pending?.text ||
            completed.at(-1)?.text ||
            'The transcript will appear here as you speak.'}
        </p>
      </section>
    </>
  );
};
