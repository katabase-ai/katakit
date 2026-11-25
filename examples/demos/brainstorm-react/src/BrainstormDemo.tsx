import { useEffect, useRef, useState, type ReactNode } from 'react';
import { bind, Subscribe } from '@react-rxjs/core';
import { drawChallenge, findChallenge } from './challenges';
import type { BrainstormConnection } from './brainstormModel';
import type { createBrainstormDemo } from './createBrainstormDemo';
import { Button } from './controls';
import { BrainstormSettings } from './BrainstormSettings';
import { useRoundSetup } from './useRoundSetup';
import './style.css';

const timeLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type BrainstormDemoProps = {
  runtime: ReturnType<typeof createBrainstormDemo>;
  listening?: boolean;
  startListening?: (signal: AbortSignal) => Promise<boolean>;
  isListening?: () => boolean;
  stopListening?: () => Promise<unknown>;
  setupMessage?: string;
  captureDisabled?: boolean;
  connect?: (input: { signal: AbortSignal }) => Promise<BrainstormConnection>;
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
const [useBrainstormState, brainstormState$] = bind(
  (runtime: BrainstormDemoProps['runtime']) => runtime.state$
);

export const BrainstormDemo = (props: BrainstormDemoProps) => (
  <Subscribe source$={brainstormState$(props.runtime)}>
    <BrainstormView {...props} />
  </Subscribe>
);

const BrainstormView = ({
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
  roundControlClassName = 'brainstorm-primary',
}: BrainstormDemoProps) => {
  const state = useBrainstormState(runtime);
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
  const locked = active || state.interrupted || !!setup.step;

  useEffect(() => {
    if (state.interrupted || state.phase !== 'finishing' || stopping.current === state.roundId)
      return;
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
  }, [state.phase, state.roundId, state.interrupted, runtime, stopListening]);

  const prepareRound = (categoryId = category, seconds = state.seconds) => {
    runtime.configure({ challengeId: drawChallenge(categoryId, state.challengeId).id, seconds });
  };
  const startRound = () =>
    setup.start(() => {
      if (state.phase === 'finished') prepareRound();
    });
  const failure = setup.error ?? state.failure;
  const roundButton: RoundButton = {
    label: state.interrupted
      ? 'Close interrupted round'
      : state.phase === 'finishing'
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
    'aria-disabled':
      (!state.interrupted && state.phase === 'finishing') ||
      setup.step === 'cancelling' ||
      undefined,
    disabled:
      !state.interrupted &&
      ((state.phase === 'finished' && state.busy) ||
        (!active &&
          !setup.step &&
          (captureDisabled ||
            (!startListening && !listening) ||
            (!connect && !state.connected) ||
            !!(state.failure?.policy.terminal && !state.failure.policy.restart)))),
    onClick: () => {
      if (state.interrupted) {
        runtime.recover();
        return;
      }
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
        <span className="brainstorm-setup-status" role="status">
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
    <section className="brainstorm-connection" aria-label="Answer judging">
      {state.interrupted && (
        <p role="status">
          This restored round is paused. Close it to seal input and allow pending judging after
          connecting, or clear it.
        </p>
      )}
      {state.interrupted && <Button onClick={runtime.clear}>Clear interrupted round</Button>}
      {state.connected && !failure && <p role="status">Judge connected.</p>}
      {!connect &&
        !state.connected &&
        (connectionHelp ?? <p>Set up a judging connection to start a round.</p>)}
      {failure && <p role="alert">{failure.message}</p>}
      {state.failure && !state.failure.policy.terminal && !state.failure.policy.restart && (
        <Button onClick={runtime.retry}>Retry judging</Button>
      )}
      {state.failure?.policy.restart && <p>Start a new round to reconnect the judge.</p>}
    </section>
  );

  return (
    <section className="brainstorm-game" aria-label="Brainstorming game">
      {showIntroduction && (
        <header className="brainstorm-header">
          <div>
            <p className="brainstorm-eyebrow">One mic. Every idea counts.</p>
            <h1 id="brainstorm-title">Brainstorm</h1>
            <p>Say your answers. Fill the board.</p>
          </div>
          <span className="brainstorm-library-label">200 challenges · 20 categories</span>
        </header>
      )}

      {controls}
      <div className="brainstorm-layout">
        <div className="brainstorm-main">
          <BrainstormSettings
            category={category}
            seconds={state.seconds}
            disabled={locked}
            onApply={(category, seconds) => {
              setCategory(category);
              prepareRound(category, seconds);
            }}
          />

          <section className="site-notice brainstorm-challenge" aria-labelledby="brainstorm-prompt">
            <div className="brainstorm-challenge-copy">
              <h2 id="brainstorm-prompt">{revealed ? challenge.prompt : 'Ready when you are.'}</h2>
              <p>{revealed ? challenge.judgingRule : 'Start round to reveal the challenge.'}</p>
            </div>
            <div className="brainstorm-round-bar">
              <div
                className="brainstorm-clock"
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
              <div className="brainstorm-score">
                <strong>{state.notes.length}</strong>
                <span>{state.notes.length === 1 ? 'answer' : 'answers'}</span>
              </div>
            </div>
            {renderRoundControls ? (
              renderRoundControls(roundControls)
            ) : (
              <div className="brainstorm-round-controls">{roundControls}</div>
            )}
          </section>

          <div className="brainstorm-board-heading">
            <h2>The shared board</h2>
            <p role="status" aria-live="polite">
              {state.interrupted
                ? 'Restored round paused.'
                : state.busy
                  ? 'Judging your latest answers…'
                  : state.phase === 'finishing'
                    ? 'Finishing the last words…'
                    : state.phase === 'finished'
                      ? `Round complete. ${state.notes.length} ${state.notes.length === 1 ? 'answer' : 'answers'} collected.`
                      : state.feedback ||
                        (state.phase === 'running' ? 'Listening for your ideas…' : '')}
            </p>
          </div>
          <div className="brainstorm-board" aria-label="Collected answers">
            {!state.notes.length && (
              <div className="brainstorm-empty">
                <p>Your answers will appear here.</p>
              </div>
            )}
            <ol className="brainstorm-notes" aria-live="polite" aria-relevant="additions removals">
              {state.notes.map((note, i) => (
                <li key={note.id} className="brainstorm-note" data-color={i % 4}>
                  <span className="brainstorm-note-number">{String(i + 1).padStart(2, '0')}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${note.text}`}
                    className="brainstorm-note-remove"
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
        <aside className="brainstorm-transcript" aria-label="Transcript">
          <h2>Transcript</h2>
          <div
            className="brainstorm-transcript-entries"
            role="region"
            aria-label="Round transcript"
            tabIndex={0}
            aria-live="polite"
            aria-relevant="additions text"
          >
            {!state.provisional && !state.segments.length && (
              <p className="brainstorm-transcript-empty">Your words will appear here.</p>
            )}
            {state.provisional && (
              <article
                className="brainstorm-transcript-entry"
                data-interim="true"
                aria-label="In progress"
              >
                <span className="brainstorm-transcript-index" aria-hidden="true">
                  ··
                </span>
                <p>{state.provisional}</p>
              </article>
            )}
            {state.segments.toReversed().map((segment, index) => (
              <article
                className="brainstorm-transcript-entry"
                key={segment.id}
                aria-label={`Entry ${state.segments.length - index}`}
              >
                <span className="brainstorm-transcript-index" aria-hidden="true">
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
