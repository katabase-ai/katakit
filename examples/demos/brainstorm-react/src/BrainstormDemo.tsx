import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { bind, Subscribe } from '@react-rxjs/core';
import { challengeCategories, drawChallenge, findChallenge } from './challenges';
import { BrainstormRequestError, type BrainstormConnection } from './brainstormModel';
import type { createBrainstormDemo } from './createBrainstormDemo';
import { Button } from './controls';
import { BrainstormSettings } from './BrainstormSettings';
import './style.css';

const timeLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type BrainstormDemoProps = {
  runtime: ReturnType<typeof createBrainstormDemo>;
  listening?: boolean;
  stopListening?: () => Promise<unknown>;
  connect?: (input: { signal: AbortSignal }) => Promise<BrainstormConnection>;
  controls?: ReactNode;
  connectionHelp?: ReactNode;
  showIntroduction?: boolean;
  renderModelControls?: (controls: ReactNode) => ReactNode;
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
  stopListening,
  connect,
  controls,
  connectionHelp,
  showIntroduction = true,
  renderModelControls = controls => controls,
}: BrainstormDemoProps) => {
  const state = useBrainstormState(runtime);
  const [category, setCategory] = useState('');
  const [typed, setTyped] = useState(false);
  const [text, setText] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [admissionError, setAdmissionError] = useState<BrainstormRequestError>();
  const admission = useRef<{ controller: AbortController; started: boolean; pending: boolean }>(
    undefined
  );
  const stopping = useRef('');
  const challenge = findChallenge(state.challengeId);
  const active = state.phase === 'running' || state.phase === 'finishing';
  const revealed = state.phase !== 'idle';

  useEffect(() => {
    const controller = new AbortController();
    admission.current = { controller, started: false, pending: false };
    setConnecting(false);
    setAdmissionError(undefined);
    runtime.setConnectionMode(!connect);
    return () => {
      controller.abort();
      admission.current = undefined;
      runtime.disconnect();
    };
  }, [runtime, connect]);

  const connectJudge = useCallback(async () => {
    const current = admission.current;
    if (!connect || !current || current.pending) return;
    current.pending = true;
    current.started = true;
    setConnecting(true);
    setAdmissionError(undefined);
    try {
      const connection = await connect({ signal: current.controller.signal });
      if (!current.controller.signal.aborted) runtime.connect(connection);
    } catch (error) {
      if (!current.controller.signal.aborted)
        setAdmissionError(
          error instanceof BrainstormRequestError
            ? error
            : new BrainstormRequestError('The judge could not connect. Try again.')
        );
    } finally {
      current.pending = false;
      if (!current.controller.signal.aborted) setConnecting(false);
    }
  }, [runtime, connect]);

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
    setText('');
  };
  const startRound = () => {
    if (state.phase === 'finished') prepareRound();
    setText('');
    runtime.begin();
  };
  const failure = state.practice ? undefined : (admissionError ?? state.failure);
  const modelControls = (
    <section className="brainstorm-connection" aria-label="Answer judging">
      <strong>{state.practice ? 'Sample practice' : 'Answer judging'}</strong>
      <p role="status">
        {state.practice
          ? 'Only the five sample answers count.'
          : connecting
            ? 'Connecting judge…'
            : state.connected
              ? 'Judge connected · transcript text is sent for judging.'
              : 'Connect a judge to accept answers beyond the examples.'}
      </p>
      {connect && !state.connected && (
        <Button onClick={() => void connectJudge()} disabled={connecting}>
          {admissionError ? 'Retry connection' : 'Connect judge'}
        </Button>
      )}
      {!connect && connectionHelp}
      {failure && <p role="alert">{failure.message}</p>}
      {state.failure && !state.failure.policy.terminal && (
        <Button onClick={runtime.retry}>Retry judging</Button>
      )}
      {state.failure?.policy.restart && (
        <Button onClick={() => void connectJudge()} disabled={connecting}>
          Restart judging session
        </Button>
      )}
      {connect && (
        <label className="brainstorm-practice-toggle">
          <input
            type="checkbox"
            checked={state.practice}
            disabled={active}
            onChange={event => runtime.setPractice(event.target.checked)}
          />{' '}
          Sample practice
        </label>
      )}
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
      <BrainstormSettings
        category={category}
        seconds={state.seconds}
        disabled={active}
        onApply={(category, seconds) => {
          setCategory(category);
          prepareRound(category, seconds);
        }}
      />

      <section className="site-notice brainstorm-challenge" aria-labelledby="brainstorm-prompt">
        <div className="brainstorm-challenge-heading">
          <span>{revealed ? 'Your challenge' : 'Next round'}</span>
          <span>
            {revealed &&
              challengeCategories.find(category =>
                category.challenges.some(item => item.id === challenge.id)
              )?.title}
          </span>
        </div>
        <h2 id="brainstorm-prompt">{revealed ? challenge.prompt : 'Ready when you are.'}</h2>
        <p>
          {revealed
            ? challenge.judgingRule
            : 'Your challenge will appear when you start the round.'}
        </p>
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
            <span>
              {state.remaining === null
                ? 'No time limit'
                : state.phase === 'finished'
                  ? 'Round complete'
                  : 'Time remaining'}
            </span>
          </div>
          <div className="brainstorm-score">
            <strong>{state.notes.length}</strong>
            <span>{state.notes.length === 1 ? 'answer' : 'answers'}</span>
          </div>
          {active ? (
            <Button
              className="brainstorm-primary"
              disabled={state.phase === 'finishing'}
              onClick={runtime.finish}
            >
              {state.phase === 'finishing' ? 'Finishing…' : 'End round'}
            </Button>
          ) : (
            <Button
              className="brainstorm-primary"
              disabled={
                (state.phase === 'finished' && state.busy) ||
                (!listening && !typed) ||
                (!state.practice && (!state.connected || state.failure?.policy.terminal))
              }
              onClick={startRound}
            >
              {state.phase === 'finished' ? 'Next round' : 'Start round'}
            </Button>
          )}
        </div>
      </section>

      <div className="brainstorm-board-heading">
        <h2>The shared board</h2>
        <p role="status" aria-live="polite">
          {state.busy
            ? 'Judging your latest answers…'
            : state.phase === 'finishing'
              ? 'Finishing the last words…'
              : state.phase === 'finished'
                ? `Round complete. ${state.notes.length} ${state.notes.length === 1 ? 'answer' : 'answers'} collected.`
                : state.feedback ||
                  (state.phase === 'running'
                    ? 'Listening for your ideas…'
                    : 'One note for every distinct answer.')}
        </p>
      </div>
      <div className="brainstorm-board" aria-label="Collected answers">
        {!state.notes.length && (
          <div className="brainstorm-empty">
            <p>
              {state.phase === 'running'
                ? 'Go on. What comes to mind?'
                : state.phase === 'finished'
                  ? 'A fresh round is a fresh start.'
                  : 'Your answers will appear here.'}
            </p>
            <span>
              {state.phase === 'idle'
                ? 'Choose a category and start your round.'
                : 'Qualifying answers will appear here as sticky notes.'}
            </span>
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

      <section className="brainstorm-input" aria-label="Round input">
        {!typed && !listening && (
          <p>Start the shared microphone to play, or use typed answers below.</p>
        )}
        <label>
          <input
            type="checkbox"
            checked={typed}
            disabled={active}
            onChange={event => setTyped(event.target.checked)}
          />
          Use typed answers
        </label>
        {typed && (
          <form
            onSubmit={event => {
              event.preventDefault();
              runtime.submitText(text);
              setText('');
            }}
          >
            <label htmlFor="brainstorm-answer">Your answers</label>
            <div>
              <input
                className="site-input"
                id="brainstorm-answer"
                value={text}
                maxLength={1000}
                disabled={state.phase !== 'running'}
                onChange={event => setText(event.target.value)}
                placeholder="Enter your answers"
                autoComplete="off"
              />
              <Button type="submit" disabled={state.phase !== 'running' || !text.trim()}>
                Add answers
              </Button>
            </div>
          </form>
        )}
        {state.practice && revealed && (
          <p className="brainstorm-practice-hint">
            <strong>Sample practice:</strong> only these examples count:{' '}
            {challenge.sampleAnswers.join(', ')}.
          </p>
        )}
        {(state.provisional || state.segments.length > 0) && (
          <details className="brainstorm-transcript">
            <summary>What we heard</summary>
            <p>
              {state.segments.map(segment => segment.text).join(' ')} <em>{state.provisional}</em>
            </p>
          </details>
        )}
      </section>
      {renderModelControls(modelControls)}
    </section>
  );
};
