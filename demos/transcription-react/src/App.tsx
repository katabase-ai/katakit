import { useEffect, useRef, useState } from 'react';
import { makeKatakit } from '@katakit/core';
import { useKatakitObservable } from '@katakit/react';
import { makeTranscriptionPlugin } from '@katakit/transcription';
import { createMoonshineInput, type InputState } from './createMoonshineInput';

const Transcription = makeTranscriptionPlugin({ turnSilenceMs: 1400 });
const kit = makeKatakit({ plugins: [Transcription.configure({})] });
const methods = kit.start().getMethods(Transcription);
const state$ = kit.getObservables(Transcription).state$;

const formatTime = (ms?: number) => {
  if (ms === undefined) return undefined;
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

export const App = () => {
  const transcript = useKatakitObservable(state$);
  const [input, setInput] = useState<InputState>({ phase: 'idle' });
  const owner = useRef<ReturnType<typeof createMoonshineInput> | null>(null);

  useEffect(() => {
    const current = createMoonshineInput({
      onState: setInput,
      onProvisional: methods.updateProvisional,
      onFinal: methods.ingestSegment,
      onStop: methods.flush,
    });
    owner.current = current;
    return () => {
      owner.current = null;
      void current.dispose();
    };
  }, []);

  const recording = input.phase === 'recording';
  const busy = ['loading', 'starting', 'stopping'].includes(input.phase);
  const available =
    window.isSecureContext &&
    window.crossOriginIsolated &&
    typeof navigator.mediaDevices?.getUserMedia === 'function';
  const turns = transcript.current ? [...transcript.turns, transcript.current] : transcript.turns;

  return (
    <main className="shell">
      <header className="topbar">
        <span className="brand">Katakit</span>
        <span className="topbar-note">A transcription demo</span>
      </header>

      <section className="workspace" aria-labelledby="title">
        <div className="intro">
          <h1 id="title">Conversation, in text.</h1>
          <p>Record in your browser. Read each conversation turn as it finishes.</p>
        </div>

        <div className="controls">
          <button
            type="button"
            className="record-button"
            data-recording={recording}
            disabled={busy || !available}
            onClick={() => void (recording ? owner.current?.stop() : owner.current?.start())}
          >
            <span className="record-icon" aria-hidden="true" />
            {recording ? 'Stop recording' : busy ? `${input.phase}…` : 'Start recording'}
          </button>
          <span className="phase" role="status" aria-live="polite">
            {input.phase === 'loading'
              ? `Loading on-device model${input.progress === undefined ? '' : ` · ${Math.round(input.progress * 100)}%`}`
              : input.phase === 'recording'
                ? 'Listening locally'
                : input.phase === 'error'
                  ? 'Recording unavailable'
                  : 'Mic is off'}
          </span>
        </div>

        {!available && (
          <p className="message" role="alert">
            This browser needs microphone access and cross-origin isolation. Open the demo on
            localhost or an HTTPS host configured with COOP/COEP headers.
          </p>
        )}
        {input.error && (
          <p className="message" role="alert">
            {input.error} Try starting again or check microphone permission.
          </p>
        )}

        <section className="transcript" aria-labelledby="transcript-heading">
          <div className="transcript-heading">
            <h2 id="transcript-heading">Transcript</h2>
            <span>{transcript.turns.length} completed turns</span>
          </div>

          {!turns.length && !transcript.provisional ? (
            <div className="empty-state">
              <p>Your conversation will appear here.</p>
              <span>Speak naturally; short transcript fragments will be grouped into turns.</span>
            </div>
          ) : (
            <div className="turn-list" aria-live="polite" aria-relevant="additions text">
              {turns.map((turn, index) => (
                <article className="turn" key={turn.id}>
                  <span className="turn-index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <p>{turn.text}</p>
                    {turn === transcript.current && (
                      <span className="working">Turn in progress</span>
                    )}
                  </div>
                  <time>{formatTime(turn.startMs)}</time>
                </article>
              ))}
              {transcript.provisional && (
                <div className="turn interim">
                  <span className="turn-index">··</span>
                  <p>{transcript.provisional}</p>
                  <span className="working">Listening</span>
                </div>
              )}
            </div>
          )}
        </section>
        <footer>
          English-only model. Audio stays in this browser. Transcript is cleared on reload.
        </footer>
      </section>
    </main>
  );
};
