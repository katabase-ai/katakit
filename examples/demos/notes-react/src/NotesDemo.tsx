import { useEffect, useId, useState, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import { TranscriptTurns } from './TranscriptTurns';
import { useNotesConnection } from './useNotesConnection';
import './style.css';

/** Listening is local. While the host listens, finalized turns go to the connected model. */
export const NotesDemo = ({
  runtime,
  connect,
  controls,
  listening = false,
  connectionHelp,
  renderModelControls = controls => controls,
  showIntroduction = true,
}: Parameters<typeof useNotesConnection>[0] & {
  controls?: ReactNode;
  connectionHelp?: ReactNode;
  /** A host can wrap connection status with verification and allowance information. */
  renderModelControls?: (controls: ReactNode) => ReactNode;
  /** Embedded hosts can supply their own page header. */
  showIntroduction?: boolean;
}) => {
  const [state, setState] = useState(() => runtime.state$.get());
  const clearHelpId = useId();
  const { notes, markdown } = state;
  const { connecting, admissionError } = useNotesConnection({ runtime, connect, listening });

  useEffect(() => {
    const subscription = runtime.state$.subscribe(setState);
    return () => subscription.unsubscribe();
  }, [runtime]);

  // Retries already ran on their own; what is left is a failure the visitor can only wait out or
  // give another chance by listening again.
  const failure = admissionError ?? (notes.status === 'paused' ? notes.failure : undefined);
  const modelControls = (
    <section className="structured-notes-model-controls" aria-label="Notes connection">
      <div role="status" aria-live="polite">
        {connecting && <p>Connecting notes…</p>}
        {failure && (
          <p>
            {failure.message || 'Notes are delayed.'}
            {!failure.policy.terminal && ' Pause and resume to try again.'}
          </p>
        )}
      </div>
      {!connect &&
        (connectionHelp ?? (
          <p>No model connection is configured. You can still transcribe locally.</p>
        ))}
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
      {controls}
      <div className="structured-notes-layout">
        <div>
          <p className="structured-notes-hint">
            Listening transcribes on your device and sends finished thoughts to the connected model.
            Stopping keeps your notes and transcript for this visit. Leaving or reloading clears
            them.
          </p>
          <div className="structured-notes-heading">
            <h2>Notes</h2>
            {(notes.notes.length > 0 || notes.failure?.policy.clearable) && (
              <button type="button" aria-describedby={clearHelpId} onClick={runtime.notes.clear}>
                Clear notes
              </button>
            )}
          </div>
          {renderModelControls(modelControls)}
          <section className="structured-notes-output" aria-label="Structured notes output">
            <p id={clearHelpId} className="structured-notes-hint">
              Clear notes removes the outline. Recent completed thoughts may still be sent as model
              context. It does not stop listening or restore used allowance.
            </p>
            {!notes.notes.length && (
              <p className="structured-notes-empty">Your notes will appear here…</p>
            )}
            <div aria-live="polite" aria-relevant="additions text">
              <Markdown skipHtml>{markdown}</Markdown>
            </div>
          </section>
        </div>
        <TranscriptTurns transcript={runtime.transcript}>
          <p className="structured-notes-hint">Spell out a misheard name to correct the note.</p>
        </TranscriptTurns>
      </div>
    </section>
  );
};
