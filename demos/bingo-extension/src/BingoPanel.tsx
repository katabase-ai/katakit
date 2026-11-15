import { useEffect, useMemo, useState } from 'react';
import { makeKatakit } from '@katakit/core';
import { useKatakitObservable } from '@katakit/react';
import { makeTranscriptionPlugin, type TranscriptSegment } from '@katakit/transcription';
import { defaultSquares, matchPhrase, parseSquares, winningLines } from './bingo';

const transcription = makeTranscriptionPlugin();
const kit = makeKatakit({ plugins: [transcription.configure({})] });
const methods = kit.start().getMethods(transcription);
const transcript$ = kit.getObservables(transcription).state$;

type Phase = 'idle' | 'loading' | 'recording' | 'error';
type CaptureState = { phase: Phase; progress?: number; error?: string; micConnected?: boolean };
type StoredBoard = { squares: string[]; overrides: Record<number, boolean> };

export const Bingo = () => {
  const transcript = useKatakitObservable(transcript$);
  const [capture, setCapture] = useState<CaptureState>({ phase: 'idle' });
  const [squares, setSquares] = useState(defaultSquares);
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [editError, setEditError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    const listener = (message: {
      type?: string;
      segment?: TranscriptSegment;
      phase?: Phase;
      progress?: number;
      error?: string;
      micConnected?: boolean;
    }) => {
      if (message.type === 'TRANSCRIPT_SEGMENT' && message.segment)
        methods.ingestSegment(message.segment);
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
        const [local, session] = await Promise.all([
          chrome.storage.local.get('board'),
          chrome.storage.session.get(['segments', 'capture']),
        ]);
        if (!mounted) return;
        const board = local.board as StoredBoard | undefined;
        if (board?.squares?.length === 25) setSquares(board.squares);
        if (board?.overrides) setOverrides(board.overrides);
        for (const segment of (session.segments ?? []) as TranscriptSegment[])
          methods.ingestSegment(segment);
        if (session.capture) setCapture(session.capture as CaptureState);
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
      void chrome.storage.local.set({ board: { squares, overrides } satisfies StoredBoard });
  }, [squares, overrides, loaded]);

  const turns = transcript.current ? [...transcript.turns, transcript.current] : transcript.turns;
  const evidence = useMemo(
    () =>
      squares.map((phrase, index) =>
        index === 12 ? undefined : turns.find(turn => matchPhrase(phrase, turn.text))?.text
      ),
    [squares, turns]
  );
  const marked = squares.map((_, index) => overrides[index] ?? (index === 12 || !!evidence[index]));
  const wins = winningLines(marked);
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

  const saveSquares = () => {
    const next = parseSquares(draft);
    if (!next) return setEditError('Enter exactly 24 phrases, one per line. The center is free.');
    setSquares(next);
    setOverrides({});
    setEditError('');
    setEditing(false);
  };

  return (
    <main className="panel">
      <header className="masthead">
        <div>
          <h1>Conversation bingo</h1>
          <p>Hear a phrase. Claim a square.</p>
        </div>
        <button
          className="quiet"
          onClick={() => {
            setDraft(squares.filter((_, i) => i !== 12).join('\n'));
            setEditing(!editing);
          }}
        >
          {editing ? 'Close editor' : 'Edit card'}
        </button>
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
              aria-pressed={marked[index]}
              title={evidence[index] ? `Heard: ${evidence[index]}` : undefined}
              onClick={() => {
                if (index !== 12)
                  setOverrides(current => ({ ...current, [index]: !marked[index] }));
              }}
            >
              <span>{phrase}</span>
              {evidence[index] && marked[index] && <span className="heard">Heard</span>}
            </button>
          ))}
        </div>
      </section>
      {editing && (
        <section className="editor" aria-label="Edit bingo card">
          <label htmlFor="phrases">Your 24 phrases</label>
          <textarea
            id="phrases"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            rows={8}
          />
          {editError && <p role="alert">{editError}</p>}
          <button className="primary" onClick={saveSquares}>
            Use these squares
          </button>
        </section>
      )}
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
          Start on a browser meeting tab. English speech is transcribed on this device; the first
          run downloads a model.
        </p>
        <button
          className="primary"
          disabled={busy || capture.phase === 'loading'}
          onClick={() => void toggleCapture()}
        >
          {busy ? 'Working…' : capture.phase === 'recording' ? 'Stop listening' : 'Start listening'}
        </button>
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
        <p aria-live="polite">
          {turns.at(-1)?.text || 'The transcript will appear here as you speak.'}
        </p>
      </section>
    </main>
  );
};
