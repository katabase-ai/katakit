import { useEffect, useState, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import { TranscriptPreview } from './TranscriptPreview';
import { useNotesConnection } from './useNotesConnection';
import './style.css';

/** Listening starts admission once per visit; failures require an explicit retry. */
export const NotesDemo = ({
  runtime,
  listening,
  connect,
  controls,
  renderModelControls = controls => controls,
}: Parameters<typeof useNotesConnection>[0] & {
  controls?: ReactNode;
  /** A gallery host can place model controls beside its shared microphone controls. */
  renderModelControls?: (controls: ReactNode) => ReactNode;
}) => {
  const [state, setState] = useState(() => runtime.state$.get());
  const { notes, markdown } = state;
  const { connecting, admissionError, connectModel } = useNotesConnection({
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
      <div role="status" aria-live="polite">
        {connecting && <p>Connecting notes…</p>}
        {failure && <p>{failure.message || 'Notes are delayed. Try again.'}</p>}
      </div>
      {admissionError && !admissionError.policy.terminal && (
        <button type="button" onClick={() => void connectModel()} disabled={connecting}>
          Retry connection
        </button>
      )}
      {notes.status === 'paused' && !notes.failure?.policy.terminal && (
        <button type="button" onClick={runtime.notes.retry}>
          Retry notes
        </button>
      )}
      {notes.failure?.policy.restart && (
        <button type="button" onClick={() => void connectModel()} disabled={connecting}>
          Restart notes session
        </button>
      )}
      {!connect && <p>This host has no model connection. You can still transcribe locally.</p>}
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
        Start listening to generate notes automatically. Audio stays on this device; notes send
        transcript text to a model provider.
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
