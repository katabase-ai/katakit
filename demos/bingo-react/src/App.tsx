import { trace } from '@opentelemetry/api';
import { bind, Subscribe } from '@react-rxjs/core';
import { combineLatest } from 'rxjs';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { makeKatakit } from '@katakit/core';
import { bingoPacks, drawBingoPack, makeBingoPlugin, type BingoPackId } from './bingo';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import { AudioLevelMeter } from './AudioLevelMeter';
import { Button, SelectField } from './controls';
import { createMicrophoneTranscriber } from '@katakit/transcription/browser';
import type { TranscriptionState } from '@katakit/transcription';
import './style.css';

const DeveloperWorkbench = import.meta.env.DEV
  ? lazy(async () => ({ default: (await import('./developerTools')).DeveloperWorkbench }))
  : null;

const transcriptIngestion = makeTranscriptIngestionPlugin();
const bingo = makeBingoPlugin({ TranscriptIngestionPlugin: transcriptIngestion });
const kit = makeKatakit({
  plugins: [transcriptIngestion.configure({}), bingo.configure({})],
  tracer: trace.getTracer('demo-bingo'),
});
const running = kit.start();
const transcriptMethods = running.getMethods(transcriptIngestion);
const bingoMethods = running.getMethods(bingo);
const { lastHeard$ } = kit.getObservables(transcriptIngestion);
const board$ = kit.getObservables(bingo).state$;
const [useLastHeard, lastHeardState$] = bind(lastHeard$);
const [useBoard, boardState$] = bind(board$);
const view$ = combineLatest([lastHeardState$, boardState$]);

const BrowserBingoView = () => {
  const lastHeard = useLastHeard();
  const board = useBoard();
  const [input, setInput] = useState<TranscriptionState>({ phase: 'idle' });
  const [audioLevel, setAudioLevel] = useState(0);
  const [packId, setPackId] = useState<BingoPackId>('meeting');
  const source = useRef<ReturnType<typeof createMicrophoneTranscriber> | null>(null);

  useEffect(() => {
    const input = createMicrophoneTranscriber({
      model: 'moonshine-tiny',
      onState: setInput,
      onLevel: setAudioLevel,
      onFinal: transcriptMethods.ingestSegment,
      onProvisional: transcriptMethods.updateProvisional,
      onStop: transcriptMethods.flush,
    });
    source.current = input;
    return () => {
      source.current = null;
      void input.dispose();
    };
  }, []);

  const toggleRecording = async () => {
    try {
      await (input.phase === 'running' ? source.current?.stop() : source.current?.start());
    } catch {
      /* onState exposes the error in the application UI. */
    }
  };

  const recording = input.phase === 'running';
  const busy = ['loading', 'starting', 'stopping'].includes(input.phase);
  const available =
    window.isSecureContext &&
    window.crossOriginIsolated &&
    typeof navigator.mediaDevices?.getUserMedia === 'function';
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
              onClick={() => void toggleRecording()}
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
              {input.error.message}
            </p>
          )}
          <div className="bingo-transcript">
            <h2>Last heard</h2>
            <p aria-live="polite">{lastHeard || 'Your conversation will appear here.'}</p>
          </div>
        </aside>
      </div>
      {DeveloperWorkbench && (
        <Suspense fallback={null}>
          <DeveloperWorkbench
            runtime={running}
            transcript={{
              observables: kit.getObservables(transcriptIngestion),
              methods: transcriptMethods,
              input: {
                status: input.phase,
                recording,
                disabled: busy || !available,
                level: audioLevel,
                onToggle: () => void toggleRecording(),
              },
            }}
          />
        </Suspense>
      )}
    </section>
  );
};

export const BrowserBingoDemo = () => (
  <Subscribe source$={view$}>
    <BrowserBingoView />
  </Subscribe>
);

export const App = () => (
  <main>
    <BrowserBingoDemo />
  </main>
);
