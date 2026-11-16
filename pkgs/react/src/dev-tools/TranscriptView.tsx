import { useCallback, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import type { Observable } from 'rxjs';
import { Button } from './ui';

type Plugin = ReturnType<ReturnType<typeof makeTranscriptIngestionPlugin>['configure']>;
/** Explicit binding to a running transcript-ingestion plugin; microphone resources remain host-owned. */
export type TranscriptInspection = {
  observables: Pick<
    ReturnType<Plugin['observables']>,
    'conversationTurns$' | 'currentTurn$' | 'provisional$'
  >;
  methods: Pick<ReturnType<Plugin['methods']>, 'ingestSegment' | 'flush'>;
  input?: {
    status: string;
    recording: boolean;
    disabled?: boolean;
    level?: number;
    onToggle: () => void;
  };
};

const useValue = <T,>(source: Observable<T> & { get: () => T }) => {
  const subscribe = useCallback(
    (notify: () => void) => {
      const subscription = source.subscribe(() => notify());
      return () => subscription.unsubscribe();
    },
    [source]
  );
  return useSyncExternalStore(subscribe, source.get, source.get);
};

export const TranscriptView = ({ binding }: { binding: TranscriptInspection }) => {
  const completed = useValue(binding.observables.conversationTurns$);
  const current = useValue(binding.observables.currentTurn$);
  const provisional = useValue(binding.observables.provisional$);
  const [text, setText] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [status, setStatus] = useState('');
  const inputId = useId();
  const sequence = useRef(0);
  const turns = current ? [...completed, current] : completed;
  return (
    <div className="kk-transcript-layout">
      <section className="kk-card" aria-label="Transcript turns">
        <div className="kk-section-heading">
          <h3>Transcript</h3>
          <span className="kk-muted">{completed.length} finalized turns</span>
        </div>
        {!turns.length && !provisional && (
          <p className="kk-empty">
            Submit text or use the application's microphone to exercise transcript-driven behavior.
          </p>
        )}
        <div className="kk-turns">
          {turns.map(turn => (
            <article key={turn.id}>
              <div className="kk-section-heading">
                <strong>{turn.speaker || 'Unattributed'}</strong>
                <span className="kk-status">{turn === current ? 'current turn' : 'finalized'}</span>
              </div>
              <p>{turn.text}</p>
              <small>
                {turn.sourceId}
                {turn.startMs === undefined ? '' : ` · ${turn.startMs} ms`}
              </small>
            </article>
          ))}
          {provisional && (
            <article className="kk-provisional">
              <span className="kk-status">provisional</span>
              <p>{provisional}</p>
            </article>
          )}
        </div>
      </section>
      <aside className="kk-card">
        <h3>Controlled input</h3>
        <p className="kk-hint">
          Submit a finalized segment through ingestion. Normal turn grouping and downstream effects
          still apply.
        </p>
        <form
          onSubmit={event => {
            event.preventDefault();
            if (!text.trim()) return;
            try {
              binding.methods.ingestSegment({
                id: `${inputId}-${++sequence.current}`,
                sourceId: 'developer-tools',
                text,
                speaker: speaker.trim() || undefined,
              });
              setText('');
              setStatus('Segment submitted.');
            } catch (error) {
              setStatus(error instanceof Error ? error.message : String(error));
            }
          }}
        >
          <label>
            Speaker (optional)
            <input value={speaker} onChange={event => setSpeaker(event.target.value)} />
          </label>
          <label>
            Text
            <textarea
              rows={5}
              value={text}
              onChange={event => setText(event.target.value)}
              placeholder="Try a phrase the application responds to…"
            />
          </label>
          <div className="kk-actions">
            <Button type="submit" disabled={!text.trim()}>
              Submit segment
            </Button>
            <Button
              onClick={() => {
                try {
                  binding.methods.flush();
                  setStatus('Turn finalized.');
                } catch (error) {
                  setStatus(String(error));
                }
              }}
            >
              Finalize turn
            </Button>
          </div>
          <p role="status" className="kk-hint">
            {status}
          </p>
        </form>
        {binding.input && (
          <div className="kk-input-controls">
            <h4>Application microphone</h4>
            <p className="kk-muted">{binding.input.status}</p>
            <meter min={0} max={1} value={binding.input.level ?? 0} aria-label="Microphone level" />
            <Button disabled={binding.input.disabled} onClick={binding.input.onToggle}>
              {binding.input.recording ? 'Stop microphone' : 'Start microphone'}
            </Button>
            <p className="kk-hint">
              Uses the application's existing capture owner. Changing workbench views keeps capture
              running.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
};
