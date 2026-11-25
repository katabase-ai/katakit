import { bind, Subscribe } from '@react-rxjs/core';
import { combineLatest } from 'rxjs';
import { useEffect, useState } from 'react';
import {
  bingoPacks,
  defaultSquares,
  drawBingoPack,
  type BingoBoard,
  type BingoPackId,
} from './bingo';
import { AudioLevelMeter } from './AudioLevelMeter';
import { createPanelRuntime, type PanelRuntime } from './runtime';
import { isSegment, orderHydration, type TranscriptMessage } from './history';

const bindRuntime = (runtime: PanelRuntime) => {
  const [useLastHeard, lastHeardState$] = bind(runtime.transcript.lastHeard$);
  const [useBoard, boardState$] = bind(runtime.board$);
  return { useLastHeard, useBoard, view$: combineLatest([lastHeardState$, boardState$]) };
};
type ReadyPanel = ReturnType<typeof bindRuntime> & {
  runtime: PanelRuntime;
  local: Record<string, unknown>;
};

type Phase = 'idle' | 'loading' | 'recording' | 'error';
type CaptureState = { phase: Phase; progress?: number; error?: string; micConnected?: boolean };

const BingoView = ({
  panel,
  capture,
  setCapture,
  micLevel,
  tabLevel,
}: {
  panel: ReadyPanel;
  capture: CaptureState;
  setCapture: (capture: CaptureState) => void;
  micLevel: number;
  tabLevel: number;
}) => {
  const lastHeard = panel.useLastHeard();
  const board = panel.useBoard();
  const { bingoMethods, restoredBoard } = panel.runtime;
  const [packId, setPackId] = useState<BingoPackId | 'custom'>(() => {
    const saved = panel.local.packId;
    if (restoredBoard && (saved === 'custom' || bingoPacks.some(pack => pack.id === saved)))
      return saved as BingoPackId | 'custom';
    return board.squares.some((phrase, index) => phrase !== defaultSquares[index])
      ? 'custom'
      : 'meeting';
  });
  const [customSquares] = useState(() => {
    const saved = panel.local.customSquares;
    return Array.isArray(saved) &&
      saved.length === 25 &&
      saved.every(value => typeof value === 'string')
      ? (saved as string[])
      : [...board.squares];
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        await chrome.storage.local.set({
          board: { squares: board.squares, overrides: board.overrides } satisfies BingoBoard,
          packId,
          customSquares,
        });
      } catch {
        /* Storage failure must not interrupt the current card. */
      }
    })();
  }, [board.squares, board.overrides, packId, customSquares]);

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

export const Bingo = () => {
  const [panel, setPanel] = useState<ReadyPanel>();
  const [capture, setCapture] = useState<CaptureState>({ phase: 'idle' });
  const [micLevel, setMicLevel] = useState(0);
  const [tabLevel, setTabLevel] = useState(0);
  useEffect(() => {
    let mounted = true;
    let runtime: PanelRuntime | undefined;
    let liveStatus = false;
    let stopped = false;
    const queued: TranscriptMessage[] = [];
    const listener = (message: Record<string, unknown>) => {
      let transcriptMessage: TranscriptMessage | undefined;
      if (message.type === 'CAPTURE_RESET') transcriptMessage = { type: 'CAPTURE_RESET' };
      if (message.type === 'TRANSCRIPT_SEGMENT' && isSegment(message.segment))
        transcriptMessage = { type: 'TRANSCRIPT_SEGMENT', segment: message.segment };
      if (transcriptMessage) {
        if (!runtime) queued.push(transcriptMessage);
        else if (transcriptMessage.type === 'CAPTURE_RESET') runtime.methods.reset();
        else runtime.methods.ingestSegment(transcriptMessage.segment);
      }
      if (message.type === 'CAPTURE_LEVEL' && typeof message.level === 'number') {
        if (message.source === 'mic') setMicLevel(message.level);
        if (message.source === 'tab') setTabLevel(message.level);
      }
      if (
        message.type === 'CAPTURE_STATUS' &&
        ['idle', 'loading', 'recording', 'error'].includes(String(message.phase))
      ) {
        liveStatus = true;
        stopped = message.phase === 'idle';
        setCapture(message as CaptureState);
        if (stopped) runtime?.methods.flush();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    void (async () => {
      const [localResult, sessionResult] = await Promise.allSettled([
        chrome.storage.local.get(['board', 'packId', 'customSquares']),
        chrome.storage.session.get(['segments', 'capture']),
      ]);
      if (!mounted) return;
      const local = localResult.status === 'fulfilled' ? localResult.value : {};
      const session = sessionResult.status === 'fulfilled' ? sessionResult.value : {};
      const { initialSegments, live } = orderHydration(session.segments, queued);
      runtime = createPanelRuntime(initialSegments, local.board);
      for (const message of live)
        if (message.type === 'TRANSCRIPT_SEGMENT') runtime.methods.ingestSegment(message.segment);
      if (stopped) runtime.methods.flush();
      if (
        !liveStatus &&
        session.capture &&
        typeof session.capture === 'object' &&
        'phase' in session.capture &&
        ['idle', 'loading', 'recording', 'error'].includes(String(session.capture.phase))
      )
        setCapture(session.capture as CaptureState);
      setPanel({ runtime, local, ...bindRuntime(runtime) });
    })();
    return () => {
      mounted = false;
      chrome.runtime.onMessage.removeListener(listener);
      runtime?.close();
    };
  }, []);
  return panel ? (
    <Subscribe source$={panel.view$}>
      <BingoView
        panel={panel}
        capture={capture}
        setCapture={setCapture}
        micLevel={micLevel}
        tabLevel={tabLevel}
      />
    </Subscribe>
  ) : (
    <p role="status">Restoring your card…</p>
  );
};
