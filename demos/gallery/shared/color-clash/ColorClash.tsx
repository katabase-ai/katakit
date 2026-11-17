import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { TranscriptionState } from '@katakit/transcription';
import type { createColorClash } from './createColorClash';
import './colorClash.css';

/** The host owns microphone/model setup; this view starts its clock only once capture is running. */
export const ColorClash = ({
  runtime,
  input,
  error,
  disabled,
  onPlay,
  onCancel,
  onStop,
}: {
  runtime: ReturnType<typeof createColorClash>;
  input: TranscriptionState;
  error?: string;
  disabled: boolean;
  onPlay: () => Promise<boolean>;
  onCancel: () => void;
  onStop: () => void;
}) => {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
  const [requested, setRequested] = useState(false);
  const transcript = useRef<HTMLDivElement>(null);
  const stopRequested = useRef(false);
  const listening = input.phase === 'running';
  const preparing = input.phase === 'loading' || input.phase === 'starting';
  const active = state.phase === 'instructions' || state.phase === 'playing';
  useEffect(() => {
    if (requested && listening) {
      setRequested(false);
      runtime.begin();
    }
  }, [requested, listening, runtime]);
  useEffect(() => {
    if (!active) return;
    if (!listening) {
      runtime.finish();
      return;
    }
    const timer = window.setInterval(runtime.advance, 50);
    return () => window.clearInterval(timer);
  }, [active, listening, runtime]);
  useEffect(() => {
    // A replay can acquire capture before its instruction screen has rendered.
    if (active) stopRequested.current = false;
    if (state.phase === 'finished' && listening && !requested && !stopRequested.current) {
      stopRequested.current = true;
      onStop();
    }
  }, [active, state.phase, listening, requested, onStop]);
  useLayoutEffect(() => {
    if (transcript.current) transcript.current.scrollLeft = transcript.current.scrollWidth;
  }, [state.transcript, state.provisional]);
  const play = async () => {
    setRequested(true);
    if (!(await onPlay())) setRequested(false);
  };
  const cancel = () => {
    setRequested(false);
    onCancel();
  };
  const inputError = error ?? input.error?.message;
  const permissionDenied = input.error?.code === 'microphone-permission-denied';
  return (
    <section className="color-clash" aria-label="Color Clash game">
      <header className="color-clash-hud">
        <div>
          <span>Time</span>
          <strong>{Math.ceil(state.remainingMs / 1000)}s</strong>
        </div>
        <div className="color-clash-score">
          <span>Score</span>
          <strong aria-live="polite">{state.score}</strong>
        </div>
      </header>
      <div className="color-clash-clock" aria-hidden="true">
        <div style={{ width: `${state.remainingMs / 200}%` }} />
      </div>
      <div className="color-clash-stage">
        {state.phase === 'playing' ? (
          <>
            <span className="color-clash-prompt">Say the ink color</span>
            {state.popped && (
              <div
                key={`pop-${state.popped.sequence}`}
                className="color-clash-position"
                style={{ left: `${state.popped.left}%`, top: `${state.popped.top}%` }}
                aria-hidden="true"
              >
                <span className="color-clash-pop" data-ink={state.popped.ink}>
                  +1
                </span>
              </div>
            )}
            <div
              key={state.target.sequence}
              className="color-clash-position"
              style={{ left: `${state.target.left}%`, top: `${state.target.top}%` }}
            >
              <div
                key={state.mistake}
                className={
                  state.mistake ? 'color-clash-target color-clash-mistake' : 'color-clash-target'
                }
                data-ink={state.target.ink}
                aria-label={`${state.target.word}, written in ${state.target.ink}`}
              >
                {state.target.word}
              </div>
            </div>
          </>
        ) : state.phase === 'instructions' ? (
          <div className="color-clash-message" role="status">
            <p>
              Say the <strong>ink color</strong>, not the word. You have 20 seconds.
            </p>
          </div>
        ) : (
          <div className="color-clash-message">
            <h3>{state.phase === 'finished' ? 'Time’s up' : 'Color Clash'}</h3>
            {preparing ? (
              <>
                <p role="status">
                  {input.phase === 'loading'
                    ? `Loading speech model${input.progress === undefined ? '…' : ` · ${Math.round(input.progress * 100)}%`}`
                    : 'Allow microphone access to play…'}
                </p>
                {input.phase === 'loading' && (
                  <progress aria-label="Speech model download" max={1} value={input.progress} />
                )}
                <button type="button" className="color-clash-play" onClick={cancel}>
                  Cancel setup
                </button>
              </>
            ) : (
              <>
                {permissionDenied ? (
                  <div className="color-clash-permission" role="alert">
                    <strong>Microphone access needed</strong>
                    <p>
                      Color Clash listens for the colors you say. Allow microphone access to play.
                    </p>
                    <p>
                      If your browser has blocked this site, allow Microphone in site settings
                      first.
                    </p>
                  </div>
                ) : inputError ? (
                  <p className="color-clash-error" role="alert">
                    {inputError}
                  </p>
                ) : undefined}
                <button
                  type="button"
                  className="color-clash-play"
                  disabled={
                    disabled ||
                    requested ||
                    (state.phase === 'finished' && (listening || input.phase === 'stopping'))
                  }
                  onClick={() => void play()}
                >
                  {permissionDenied
                    ? 'Try microphone again'
                    : inputError
                      ? 'Try again'
                      : state.phase === 'finished'
                        ? 'Play again'
                        : 'Play'}
                </button>
                {permissionDenied && (
                  <details className="color-clash-permission-help">
                    <summary>How to enable it</summary>
                    <ol>
                      <li>Open this site's permissions beside your browser's address bar.</li>
                      <li>Set Microphone to Allow, or reset the blocked permission.</li>
                      <li>Return here and choose Try microphone again.</li>
                    </ol>
                    <p>
                      Still blocked? Check that your computer's privacy settings allow your browser
                      to use the microphone.
                    </p>
                  </details>
                )}
              </>
            )}
            {state.phase === 'ready' && input.phase === 'idle' && (
              <p className="color-clash-privacy">
                Local speech. First play needs a model download and microphone access.
              </p>
            )}
          </div>
        )}
      </div>
      <div
        ref={transcript}
        className="color-clash-transcript"
        role="log"
        aria-label="Live transcript"
        aria-live="off"
      >
        {state.transcript || state.provisional ? (
          <>
            <span>{state.transcript} </span>
            <span className="color-clash-provisional">{state.provisional}</span>
          </>
        ) : undefined}
      </div>
    </section>
  );
};
