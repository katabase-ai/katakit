import { useEffect, useId, useState, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import { TranscriptPreview } from './TranscriptPreview';
import { useNotesConnection } from './useNotesConnection';
import './style.css';

/** Listening is local; Start notes explicitly admits remote inference for this visit. */
export const NotesDemo = ({
  runtime,
  connect,
  controls,
  connectionHelp,
  renderModelControls = controls => controls,
  showIntroduction = true,
}: Parameters<typeof useNotesConnection>[0] & {
  controls?: ReactNode;
  connectionHelp?: ReactNode;
  /** A host can wrap model controls with verification and allowance information. */
  renderModelControls?: (controls: ReactNode) => ReactNode;
  /** Embedded hosts can supply their own page header. */
  showIntroduction?: boolean;
}) => {
  const [state, setState] = useState(() => runtime.state$.get());
  const clearHelpId = useId();
  const statusId = useId();
  const connectionHelpId = useId();
  const { notes, markdown } = state;
  const { connecting, connected, paused, admissionError, connectModel, pause } = useNotesConnection(
    {
      runtime,
      connect,
    }
  );

  useEffect(() => {
    const subscription = runtime.state$.subscribe(setState);
    return () => subscription.unsubscribe();
  }, [runtime]);

  const failure = admissionError ?? notes.failure;
  const status = connecting
    ? 'Connecting notes…'
    : failure
      ? failure.message || 'Notes are delayed. Try again.'
      : paused
        ? 'Notes paused. Choose Start notes to resume.'
        : connected
          ? notes.status === 'requesting'
            ? 'Updating notes…'
            : 'Notes are on. Waiting for your next completed thought.'
          : connect
            ? 'Notes are off. Choose Start notes to begin.'
            : undefined;
  const modelControls = (
    <section className="structured-notes-model-controls" aria-label="Notes connection">
      <h2>Notes model</h2>
      {!connected || notes.status === 'paused' ? (
        <button
          type="button"
          aria-describedby={connect ? statusId : connectionHelpId}
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
        <button type="button" aria-describedby={statusId} onClick={pause}>
          Pause notes
        </button>
      )}
      <div id={statusId} role="status" aria-atomic="true">
        {status && <p>{status}</p>}
      </div>
      {!connect && (
        <div id={connectionHelpId}>
          {connectionHelp ?? (
            <p>No model connection is configured. You can still transcribe locally.</p>
          )}
        </div>
      )}
    </section>
  );

  return (
    <section className="structured-notes" aria-label="Structured notes">
      {showIntroduction && (
        <>
          <h1>Structured notes</h1>
          <p className="structured-notes-intro">
            Talk through a plan: what needs to happen, when, and what comes next. Notes take shape
            as you finish each thought.
          </p>
        </>
      )}
      <p className="structured-notes-hint">
        Start listening to transcribe on your device. Choose Start notes to send transcribed text to
        the connected model. Audio stays on your device. Pause notes stops model requests while
        listening continues.
      </p>
      {controls}
      {renderModelControls(modelControls)}
      <section className="structured-notes-output" aria-label="Structured notes output">
        <div className="structured-notes-heading">
          <h2>Your notes</h2>
          <button type="button" aria-describedby={clearHelpId} onClick={runtime.notes.clear}>
            Clear notes
          </button>
        </div>
        <p id={clearHelpId} className="structured-notes-hint">
          Clear notes removes the outline; earlier completed thoughts remain as model context. It
          does not stop listening or restore used allowance.
        </p>
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
      <p className="structured-notes-hint">
        Pausing keeps your notes and transcript for this visit. Leaving this demo or reloading
        clears its local content.
      </p>
    </section>
  );
};
