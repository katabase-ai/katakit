import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { createNotesDemo } from './createNotesDemo';
import { NotesRequestError, type NotesConnection } from './notesModel';
import './style.css';

/** Local speech remains independent; only an explicit notes action invokes the host connection. */
export const NotesDemo = ({
  runtime,
  connect,
  controls,
}: {
  runtime: ReturnType<typeof createNotesDemo>;
  connect?: (input: { signal: AbortSignal }) => Promise<NotesConnection>;
  controls?: ReactNode;
}) => {
  const [transcript, setTranscript] = useState(() => runtime.state$.value);
  const { notes } = transcript;
  const [connecting, setConnecting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [admissionError, setAdmissionError] = useState<NotesRequestError>();
  const owner = useRef<{ lifetime: AbortController; connecting: boolean } | undefined>(undefined);

  useEffect(() => {
    const subscription = runtime.state$.subscribe(setTranscript);
    const lifetime = new AbortController();
    owner.current = { lifetime, connecting: false };
    return () => {
      owner.current = undefined;
      lifetime.abort();
      subscription.unsubscribe();
      // Capture drains after unmount; those final turns must not start another paid request.
      runtime.notes.close();
    };
  }, [runtime]);

  const connectModel = async () => {
    const current = owner.current;
    if (!current || current.connecting || !connect) return;
    current.connecting = true;
    setAttempted(true);
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
  };

  const turns = transcript.current ? [...transcript.turns, transcript.current] : transcript.turns;

  return (
    <section className="live-notes" aria-label="Live discussion notes">
      <h1>Live discussion notes</h1>
      <p>Talk about an idea and watch notes build as you finish each thought.</p>
      <p>Audio stays on this device. Transcript text may be sent to a model provider.</p>
      <p>
        Start listening with the microphone controls. Choose Start notes to send this visit’s
        transcript for notes.
      </p>
      {controls}
      <div className="live-notes-controls">
        {!attempted && (
          <button type="button" onClick={() => void connectModel()} disabled={!connect}>
            Start notes
          </button>
        )}
        <button type="button" onClick={runtime.notes.clear}>
          Clear notes
        </button>
      </div>
      {!connect && (
        <p>This host has no model connection configured. You can still transcribe locally.</p>
      )}
      <div className="live-notes-columns">
        <section aria-label="Transcript">
          <h2>Transcript</h2>
          {!turns.length && !transcript.provisional && (
            <p className="live-notes-empty">
              Talk about a plan, an idea, or something you’re working through.
            </p>
          )}
          {turns.map(turn => (
            <p key={turn.id} data-final={turn !== transcript.current}>
              {turn.text}
            </p>
          ))}
          {transcript.provisional && (
            <p className="live-notes-provisional">{transcript.provisional}</p>
          )}
        </section>
        <section aria-label="Discussion notes">
          <h2>Notes</h2>
          <div role="status" aria-live="polite">
            {connecting && 'Connecting notes…'}
            {notes.failure && <p>{notes.failure.message}</p>}
            {admissionError && <p>{admissionError.message}</p>}
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
          {!notes.notes.length && !notes.failure && !admissionError && (
            <p className="live-notes-empty">
              Notes appear as you finish each thought. Spell out a misheard name to correct it.
            </p>
          )}
          <ul aria-live="polite" aria-relevant="additions text">
            {notes.notes.map(note => (
              <li key={note.id}>
                <span>{note.text}</span>
                {!!note.children.length && (
                  <ul>
                    {note.children.map(child => (
                      <li key={child.id}>{child.text}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p>Misheard a name? Spell it out to correct the note. The transcript keeps what was heard.</p>
    </section>
  );
};
