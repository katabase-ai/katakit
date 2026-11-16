import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { emitText, events$ } from './katakit';
import './style.css';

type TextEvent = ReturnType<typeof events$.getAll>[number];

const App = () => {
  const [text, setText] = useState('');
  const [events, setEvents] = useState<TextEvent[]>(() => events$.getAll());
  const [error, setError] = useState('');

  useEffect(() => {
    // Subscribe to Katakit's replayable event stream; release the listener on unmount.
    const subscription = events$.subscribe(() => setEvents(events$.getAll()));
    return () => subscription.unsubscribe();
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) {
      setError('Enter some text before adding it.');
      return;
    }
    try {
      emitText(value);
      setText('');
      setError('');
    } catch {
      setError('Could not add text. Please try again.');
    }
  };

  return (
    <main>
      <h1>Katakit text log</h1>
      <p>Type a note to send it through a local Katakit event-log plugin.</p>
      <form onSubmit={submit}>
        <label htmlFor="message">Text</label>
        <div className="entry">
          <input
            id="message"
            aria-label="Text"
            value={text}
            onChange={event => setText(event.target.value)}
          />
          <button type="submit">Add text</button>
        </div>
      </form>
      {error && <p role="alert">{error}</p>}
      <h2>Events</h2>
      {events.length === 0 ? (
        <p>No text added yet.</p>
      ) : (
        <ul>
          {events.map((event, index) => (
            <li key={index}>{event.text}</li>
          ))}
        </ul>
      )}
      <p className="note">
        In-memory only · Reloading clears the log · Nothing is sent to a service.
      </p>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
