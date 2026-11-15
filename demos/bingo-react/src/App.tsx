import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { makeKatakit } from '@katakit/core';
import { bingoPacks, drawBingoPack, makeBingoPlugin, type BingoPackId } from '@katakit/bingo';
import { makeTranscriptionPlugin } from '@katakit/transcription';
import { AudioLevelMeter, Button, SelectField } from '@katakit/site-ui';
import {
  createMoonshineInput,
  type InputState,
} from '../../transcription-react/src/createMoonshineInput';
import './style.css';

const transcription = makeTranscriptionPlugin();
const bingo = makeBingoPlugin();
const kit = makeKatakit({ plugins: [transcription.configure({}), bingo.configure({})] });
const running = kit.start();
const transcriptMethods = running.getMethods(transcription);
const bingoMethods = running.getMethods(bingo);
const transcript$ = kit.getObservables(transcription).state$;
const board$ = kit.getObservables(bingo).state$;
const subscribeToTranscript = (onChange: () => void) => {
  const subscription = transcript$.subscribe(onChange);
  return () => subscription.unsubscribe();
};
const getTranscript = () => transcript$.get();
const subscribeToBoard = (onChange: () => void) => {
  const subscription = board$.subscribe(onChange);
  return () => subscription.unsubscribe();
};
const getBoard = () => board$.get();

export const BrowserBingoDemo = () => {
  const transcript = useSyncExternalStore(subscribeToTranscript, getTranscript, getTranscript);
  const board = useSyncExternalStore(subscribeToBoard, getBoard, getBoard);
  const [input, setInput] = useState<InputState>({ phase: 'idle' });
  const [audioLevel, setAudioLevel] = useState(0);
  const [packId, setPackId] = useState<BingoPackId>('meeting');
  const source = useRef<ReturnType<typeof createMoonshineInput> | null>(null);

  useEffect(() => {
    const subscription = transcript$.subscribe(state =>
      bingoMethods.setTurns(state.current ? [...state.turns, state.current] : state.turns)
    );
    const input = createMoonshineInput({
      modelId: 'moonshine-tiny',
      onState: setInput,
      onLevel: setAudioLevel,
      onProvisional: transcriptMethods.updateProvisional,
      onFinal: transcriptMethods.ingestSegment,
      onStop: transcriptMethods.flush,
    });
    source.current = input;
    return () => {
      source.current = null;
      subscription.unsubscribe();
      void input.dispose();
    };
  }, []);

  const recording = input.phase === 'recording';
  const busy = ['loading', 'starting', 'stopping'].includes(input.phase);
  const available =
    window.isSecureContext &&
    window.crossOriginIsolated &&
    typeof navigator.mediaDevices?.getUserMedia === 'function';
  const turns = transcript.current ? [...transcript.turns, transcript.current] : transcript.turns;
  const markedCount = board.marked.filter(Boolean).length - 1;

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
          <h2>Play along</h2>
          <p>
            Speak into your microphone. Moonshine Tiny streams English transcription on this device.
          </p>
          <div className="bingo-actions">
            <Button
              variant={recording ? 'border' : 'blue'}
              disabled={busy || !available}
              onClick={() => void (recording ? source.current?.stop() : source.current?.start())}
            >
              {recording ? 'Stop listening' : busy ? 'Preparing…' : 'Start listening'}
            </Button>
          </div>
          <div className="bingo-audio-level">
            <AudioLevelMeter active={recording} level={audioLevel} />
          </div>
          {!available && (
            <p className="bingo-error" role="alert">
              Microphone access needs a supported browser and cross-origin isolation (COOP/COEP).
            </p>
          )}
          {input.phase === 'loading' && (
            <p role="status">
              Loading model
              {input.progress === undefined ? '…' : `: ${Math.round(input.progress * 100)}%`}
            </p>
          )}
          {input.error && (
            <p className="bingo-error" role="alert">
              {input.error}
            </p>
          )}
          <div className="bingo-transcript">
            <h2>Last heard</h2>
            <p aria-live="polite">
              {transcript.provisional ||
                turns.at(-1)?.text ||
                'Your conversation will appear here.'}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
};

export const App = () => (
  <main>
    <BrowserBingoDemo />
  </main>
);
