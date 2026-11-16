import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import type { createNotesDemo } from './createNotesDemo';
import { NotesRequestError, type NotesConnection } from './notesModel';
import './style.css';

/** Listening starts admission once per visit; failures require an explicit retry. */
export const NotesDemo = ({
  runtime,
  listening,
  connect,
  controls,
  renderModelControls = controls => controls,
}: {
  runtime: ReturnType<typeof createNotesDemo>;
  listening: boolean;
  connect?: (input: { signal: AbortSignal }) => Promise<NotesConnection>;
  controls?: ReactNode;
  /** A gallery host can place model controls beside its shared microphone controls. */
  renderModelControls?: (controls: ReactNode) => ReactNode;
}) => {
  const [transcript, setTranscript] = useState(() => runtime.state$.get());
  const { notes } = transcript;
  const [connecting, setConnecting] = useState(false);
  const [admissionError, setAdmissionError] = useState<NotesRequestError>();
  const owner = useRef<
    { lifetime: AbortController; connecting: boolean; attempted: boolean } | undefined
  >(undefined);
  const transcriptView = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const view = transcriptView.current;
    if (view) view.scrollTop = view.scrollHeight;
  }, [transcript.turns.length, transcript.current?.text, transcript.provisional]);

  useEffect(() => {
    const subscription = runtime.state$.subscribe(setTranscript);
    const lifetime = new AbortController();
    owner.current = { lifetime, connecting: false, attempted: false };
    return () => {
      owner.current = undefined;
      lifetime.abort();
      subscription.unsubscribe();
      // Capture drains after unmount; those final turns must not start another paid request.
      runtime.notes.close();
    };
  }, [runtime]);

  const connectModel = useCallback(async () => {
    const current = owner.current;
    if (!current || current.connecting || !connect) return;
    current.connecting = true;
    current.attempted = true;
    setConnecting(true);
    setAdmissionError(undefined);
    try {
      const connection = await connect({ signal: current.lifetime.signal });
      if (owner.current === current) {
        runtime.notes.connect(connection);
      }
    } catch (error) {
      if (owner.current === current)
        setAdmissionError(
          error instanceof NotesRequestError
            ? error
            : new NotesRequestError('Notes could not connect. Try again.')
        );
    } finally {
      current.connecting = false;
      if (owner.current === current) setConnecting(false);
    }
  }, [connect, runtime]);

  useEffect(() => {
    // Keep admission and the connection through stop/drain so the last turn can produce notes.
    // Stop/start and host rerenders must not retry failed admission or replace the allowance.
    if (listening && !owner.current?.attempted) void connectModel();
  }, [listening, connectModel]);

  const turns = transcript.current ? [...transcript.turns, transcript.current] : transcript.turns;
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
          <Markdown skipHtml>{transcript.markdown}</Markdown>
        </div>
      </section>
      <section className="structured-notes-transcript" aria-label="Transcript">
        <h2>What you’re saying</h2>
        <div className="structured-notes-transcript-tail" ref={transcriptView}>
          {!turns.length && !transcript.provisional && (
            <p className="structured-notes-empty">Your latest words appear here.</p>
          )}
          {turns.slice(-8).map(turn => (
            <p key={turn.id} data-final={turn !== transcript.current}>
              {turn.text}
            </p>
          ))}
          {transcript.provisional && (
            <p className="structured-notes-provisional">{transcript.provisional}</p>
          )}
        </div>
      </section>
      <p className="structured-notes-hint">
        Misheard a name? Spell it out to correct the note. The transcript keeps what was heard.
      </p>
    </section>
  );
};
