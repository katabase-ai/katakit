import { useEffect, useState, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import { TranscriptPreview } from './TranscriptPreview';
import { useNotesConnection } from './useNotesConnection';
import './style.css';

/** Listening is local; Start notes explicitly admits remote inference for this visit. */
export const NotesDemo = ({
  runtime,
  listening,
  connect,
  controls,
  connectionHelp,
  renderModelControls = controls => controls,
}: Parameters<typeof useNotesConnection>[0] & {
  controls?: ReactNode;
  connectionHelp?: ReactNode;
  /** A host can wrap model controls with verification and allowance information. */
  renderModelControls?: (controls: ReactNode) => ReactNode;
}) => {
  const [state, setState] = useState(() => runtime.state$.get());
  const { notes, markdown } = state;
  const { connecting, connected, admissionError, connectModel, pause } = useNotesConnection({
    runtime,
    listening,
    connect,
  });

  useEffect(() => {
    const subscription = runtime.state$.subscribe(setState);
    return () => subscription.unsubscribe();
  }, [runtime]);

  const failure = admissionError ?? notes.failure;
  const modelControls = (
    <section className="structured-notes-model-controls" aria-label="Notes connection">
      <h2>Notes model</h2>
      {!connected || notes.status === 'paused' ? (
        <button
          type="button"
          onClick={() =>
            connected &&
            notes.status === 'paused' &&
            !notes.failure?.policy.terminal &&
            !notes.failure?.policy.restart
              ? runtime.notes.retry()
              : void connectModel()
          }
          disabled={
            !connect ||
            connecting ||
            !!admissionError?.policy.terminal ||
            (!!notes.failure?.policy.terminal && !notes.failure.policy.restart)
          }
        >
          {connecting ? 'Connecting…' : 'Start notes'}
        </button>
      ) : (
        <button type="button" onClick={pause}>
          Pause notes
        </button>
      )}
      <div role="status" aria-live="polite">
        {connecting && <p>Connecting notes…</p>}
        {failure && <p>{failure.message || 'Notes are delayed. Try again.'}</p>}
      </div>
      {!connect &&
        (connectionHelp ?? (
          <p>No model connection is configured. You can still transcribe locally.</p>
        ))}
    </section>
  );

  return (
    <section className="structured-notes" aria-label="Structured notes">
      <h1>Structured notes</h1>
      <p className="structured-notes-intro">
        Talk through a plan: what needs to happen, when, and what comes next. Notes take shape as
        you finish each thought.
      </p>
      <p className="structured-notes-hint">
        Listen locally, then choose Start notes to send transcript text to your selected model
        provider. Audio stays on this device. Pausing notes keeps your transcript for when you
        resume.
      </p>
      {controls}
      {renderModelControls(modelControls)}
      <section className="structured-notes-output" aria-label="Structured notes output">
        <div className="structured-notes-heading">
          <h2>Your notes</h2>
          <button type="button" onClick={runtime.notes.clear}>
            Clear notes
          </button>
        </div>
        {!notes.notes.length && (
          <p className="structured-notes-empty">
            Try planning a trip or describing your next project.
          </p>
        )}
        <div aria-live="polite" aria-relevant="additions text">
          <Markdown skipHtml>{markdown}</Markdown>
        </div>
      </section>
      <TranscriptPreview events$={runtime.transcriptEvents$} />
    </section>
  );
};
