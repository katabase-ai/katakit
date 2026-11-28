import { useEffect, useRef, useState, type ReactNode } from 'react';
import { bind, Subscribe } from '@react-rxjs/core';
import { drawChallenge, findChallenge } from './challenges';
import type { WordRushConnection } from './wordRushModel';
import type { createWordRushDemo } from './createWordRushDemo';
import { Button } from './ui/controls';
import { WordRushSettings } from './WordRushSettings';
import { useRoundSetup } from './useRoundSetup';
import './style.css';

const timeLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type WordRushDemoProps = {
  runtime: ReturnType<typeof createWordRushDemo>;
  listening?: boolean;
  startListening?: (signal: AbortSignal) => Promise<boolean>;
  isListening?: () => boolean;
  stopListening?: () => Promise<unknown>;
  setupMessage?: string;
  captureDisabled?: boolean;
  connect?: (input: { signal: AbortSignal }) => Promise<WordRushConnection>;
  controls?: ReactNode;
  connectionHelp?: ReactNode;
  showIntroduction?: boolean;
  renderModelControls?: (controls: ReactNode) => ReactNode;
  renderRoundControls?: (controls: ReactNode) => ReactNode;
  renderRoundButton?: (button: RoundButton) => ReactNode;
  roundControlClassName?: string;
};

type RoundButton = {
  label: string;
  onClick: () => void;
  disabled: boolean;
  secondary: boolean;
  className?: string;
  'aria-disabled'?: boolean;
};

// A stable factory binding shares state only among consumers of the same visit's runtime.
const [useWordRushState, wordRushState$] = bind(
  (runtime: WordRushDemoProps['runtime']) => runtime.state$
);

export const WordRushDemo = (props: WordRushDemoProps) => (
  <Subscribe source$={wordRushState$(props.runtime)}>
    <WordRushView {...props} />
  </Subscribe>
);

const WordRushView = ({
  runtime,
  listening = false,
  startListening,
  isListening,
  stopListening,
  setupMessage,
  captureDisabled = false,
  connect,
  controls,
  connectionHelp,
  showIntroduction = true,
  renderModelControls = controls => controls,
  renderRoundControls,
  renderRoundButton,
  roundControlClassName = 'word-rush-primary',
}: WordRushDemoProps) => {
  const state = useWordRushState(runtime);
  const [category, setCategory] = useState('');
  const setup = useRoundSetup({
    runtime,
    connect,
    listening,
    startListening,
    isListening,
    stopListening,
  });
  const stopping = useRef('');
  const challenge = findChallenge(state.challengeId);
  const active = state.phase === 'running' || state.phase === 'finishing';
  const revealed = state.phase !== 'idle';
  const locked = active || !!setup.step;

  useEffect(() => {
    if (state.phase !== 'finishing' || stopping.current === state.roundId) return;
    stopping.current = state.roundId;
    void (async () => {
      try {
        await stopListening?.();
      } catch {
        /* The input host owns microphone error reporting. */
      } finally {
        if (runtime.state$.value.roundId === state.roundId) runtime.flush();
      }
    })();
  }, [state.phase, state.roundId, runtime, stopListening]);

  const prepareRound = (categoryId = category, seconds = state.seconds) => {
    runtime.configure({ challengeId: drawChallenge(categoryId, state.challengeId).id, seconds });
  };
  const startRound = () =>
    setup.start(() => {
      if (state.phase === 'finished') prepareRound();
    });
  const failure = setup.error ?? state.failure;
  const roundButton: RoundButton = {
    label:
      state.phase === 'finishing'
        ? 'Finishing…'
        : active
          ? 'End round'
          : setup.step === 'cancelling'
            ? 'Cancelling…'
            : setup.step
              ? 'Cancel setup'
              : state.phase === 'finished'
                ? 'Next round'
                : 'Start round',
    className: roundControlClassName,
    secondary: active || !!setup.step,
    'aria-disabled': state.phase === 'finishing' || setup.step === 'cancelling' || undefined,
    disabled:
      (state.phase === 'finished' && state.busy) ||
      (!active &&
        !setup.step &&
        (captureDisabled ||
          (!startListening && !listening) ||
          (!connect && !state.connected) ||
          !!(state.failure?.policy.terminal && !state.failure.policy.restart))),
    onClick: () => {
      if (state.phase === 'finishing' || setup.step === 'cancelling') return;
      if (active) runtime.finish();
      else if (setup.step) setup.cancel();
      else startRound();
    },
  };
  const roundControls = (
    <>
      {renderRoundButton ? (
        renderRoundButton(roundButton)
      ) : (
        <Button
          className={roundButton.className}
          aria-disabled={roundButton['aria-disabled']}
          disabled={roundButton.disabled}
          onClick={roundButton.onClick}
        >
          {roundButton.label}
        </Button>
      )}
      {setup.step && (
        <span className="word-rush-setup-status" role="status">
          {setup.step === 'judge'
            ? 'Connecting judge…'
            : setup.step === 'cancelling'
              ? 'Cancelling setup…'
              : (setupMessage ?? 'Preparing microphone…')}
        </span>
      )}
    </>
  );
  const modelControls = (
    <section className="word-rush-connection" aria-label="Answer judging">
      {state.connected && !failure && <p role="status">Judge connected.</p>}
      {!connect &&
        !state.connected &&
        (connectionHelp ?? <p>Configure a judging connection to play.</p>)}
      {failure && <p role="alert">{failure.message}</p>}
      {state.failure && !state.failure.policy.terminal && !state.failure.policy.restart && (
        <Button onClick={runtime.retry}>Retry judging</Button>
      )}
      {state.failure?.policy.restart && <p>Start a new round to reconnect the judge.</p>}
    </section>
  );

  return (
    <section className="word-rush" aria-label="Word rush game">
      {showIntroduction && (
        <header className="word-rush-header">
          <div>
            <p className="word-rush-eyebrow">One mic. Every idea counts.</p>
            <h1 id="word-rush-title">Word rush</h1>
            <p>Say your answers. Fill the board.</p>
          </div>
          <span className="word-rush-library-label">200 challenges · 20 categories</span>
        </header>
      )}

      {controls}
      <div className="word-rush-layout">
        <div className="word-rush-main">
          <WordRushSettings
            category={category}
            seconds={state.seconds}
            disabled={locked}
            onApply={(category, seconds) => {
              setCategory(category);
              prepareRound(category, seconds);
            }}
          />

          <section className="site-notice word-rush-challenge" aria-labelledby="word-rush-prompt">
            <div className="word-rush-challenge-copy">
              <h2 id="word-rush-prompt">{revealed ? challenge.prompt : 'Ready when you are.'}</h2>
              <p>{revealed ? challenge.judgingRule : 'Start round to reveal the challenge.'}</p>
            </div>
            <div className="word-rush-round-bar">
              <div
                className="word-rush-clock"
                data-urgent={
                  state.phase === 'running' && state.remaining !== null && state.remaining <= 10
                }
              >
                <output
                  aria-label={state.remaining === null ? 'Unlimited round' : 'Time remaining'}
                  role="timer"
                >
                  {state.remaining === null ? 'Unlimited' : timeLabel(state.remaining)}
                </output>
              </div>
              <div className="word-rush-score">
                <strong>{state.notes.length}</strong>
                <span>{state.notes.length === 1 ? 'answer' : 'answers'}</span>
              </div>
            </div>
            {renderRoundControls ? (
              renderRoundControls(roundControls)
            ) : (
              <div className="word-rush-round-controls">{roundControls}</div>
            )}
          </section>

          <div className="word-rush-board-heading">
            <h2>The shared board</h2>
            <p role="status" aria-live="polite">
              {state.busy
                ? 'Judging your latest answers…'
                : state.phase === 'finishing'
                  ? 'Finishing the last words…'
                  : state.phase === 'finished'
                    ? `Round complete. ${state.notes.length} ${state.notes.length === 1 ? 'answer' : 'answers'} collected.`
                    : state.feedback ||
                      (state.phase === 'running' ? 'Listening for your ideas…' : '')}
            </p>
          </div>
          <div className="word-rush-board" aria-label="Collected answers">
            {!state.notes.length && (
              <div className="word-rush-empty">
                <p>Your answers will appear here.</p>
              </div>
            )}
            <ol className="word-rush-notes" aria-live="polite" aria-relevant="additions removals">
              {state.notes.map((note, i) => (
                <li key={note.id} className="word-rush-note" data-color={i % 4}>
                  <span className="word-rush-note-number">{String(i + 1).padStart(2, '0')}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${note.text}`}
                    className="word-rush-note-remove"
                    onClick={() => runtime.remove(note.id)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="m6 6 12 12M6 18 18 6" />
                    </svg>
                  </Button>
                  <p title={`Heard: ${note.evidence}`}>{note.text}</p>
                </li>
              ))}
            </ol>
          </div>

          {renderModelControls(modelControls)}
        </div>
        <aside className="word-rush-transcript" aria-label="Transcript">
          <h2>Transcript</h2>
          <div
            className="word-rush-transcript-entries"
            role="region"
            aria-label="Round transcript"
            tabIndex={0}
            aria-live="polite"
            aria-relevant="additions text"
          >
            {!state.provisional && !state.segments.length && (
              <p className="word-rush-transcript-empty">Your words will appear here.</p>
            )}
            {state.provisional && (
              <article
                className="word-rush-transcript-entry"
                data-interim="true"
                aria-label="In progress"
              >
                <span className="word-rush-transcript-index" aria-hidden="true">
                  ··
                </span>
                <p>{state.provisional}</p>
              </article>
            )}
            {state.segments.toReversed().map((segment, index) => (
              <article
                className="word-rush-transcript-entry"
                key={segment.id}
                aria-label={`Entry ${state.segments.length - index}`}
              >
                <span className="word-rush-transcript-index" aria-hidden="true">
                  {String(state.segments.length - index).padStart(2, '0')}
                </span>
                <p>{segment.text}</p>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
};
