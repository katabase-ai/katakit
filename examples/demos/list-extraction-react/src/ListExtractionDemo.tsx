import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { bind, Subscribe } from '@react-rxjs/core';
import type { ListExtractionRuntime } from './createListExtractionDemo';
import { formatTime, presets, type ExtractionConnect, type ListRule } from './extractionModel';
import { TranscriptTurns } from './TranscriptTurns';
import './style.css';

type ViewState = ReturnType<ListExtractionRuntime['state$']['get']>;
type Props = {
  runtime: ListExtractionRuntime;
  connect?: ExtractionConnect;
  controls?: ReactNode;
  listening?: boolean;
  captureBusy?: boolean;
  showIntroduction?: boolean;
  connectionHelp?: ReactNode;
  renderModelControls?: (controls: ReactNode) => ReactNode;
};

const RuleEditor = ({
  rule,
  index,
  count,
  onChange,
  onRemove,
  disabled,
}: {
  rule: ListRule;
  index: number;
  count: number;
  onChange: (rule: ListRule) => void;
  onRemove: () => void;
  disabled: boolean;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="extraction-rule">
      <div className="extraction-rule-row">
        <label htmlFor={`extraction-type-${rule.id}`}>{index ? 'Also collect' : 'Collect'}</label>
        <select
          className="site-select"
          id={`extraction-type-${rule.id}`}
          value={rule.preset}
          disabled={disabled}
          onChange={event => {
            const preset = event.target.value as ListRule['preset'];
            onChange({ ...rule, preset, name: preset === 'Custom' ? 'Custom list' : preset });
            if (preset === 'Custom') setOpen(true);
          }}
        >
          {Object.keys(presets).map(preset => (
            <option key={preset}>{preset}</option>
          ))}
        </select>
        <button
          type="button"
          className="extraction-quiet"
          aria-expanded={open}
          aria-controls={`extraction-options-${rule.id}`}
          onClick={() => setOpen(!open)}
        >
          Customize
        </button>
        {count > 1 && (
          <button
            type="button"
            className="extraction-quiet"
            disabled={disabled}
            onClick={onRemove}
            aria-label={`Remove list ${index + 1}`}
          >
            Remove
          </button>
        )}
      </div>
      <p className="extraction-rule-hint">{presets[rule.preset]}</p>
      <div id={`extraction-options-${rule.id}`} className="extraction-options" hidden={!open}>
        <label className="extraction-field">
          List name
          <input
            type="text"
            value={rule.name}
            maxLength={100}
            disabled={disabled}
            onChange={event => onChange({ ...rule, name: event.target.value || 'Untitled list' })}
          />
        </label>
        <fieldset disabled={disabled}>
          <legend>Item wording</legend>
          {(['clean', 'quote'] as const).map(wording => (
            <label key={wording}>
              <input
                type="radio"
                name={`wording-${rule.id}`}
                checked={rule.wording === wording}
                onChange={() => onChange({ ...rule, wording })}
              />
              {wording === 'clean' ? 'Cleaned up' : 'Exact quotes'}
            </label>
          ))}
        </fieldset>
        <label className="extraction-field">
          What to include or leave out
          <textarea
            value={rule.instructions}
            maxLength={2000}
            rows={2}
            disabled={disabled}
            placeholder={
              rule.preset === 'Custom'
                ? 'Describe exactly what qualifies for this list'
                : 'For example, only tasks related to the launch'
            }
            onChange={event => onChange({ ...rule, instructions: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
};

const ExtractionView = ({
  runtime,
  connect,
  controls,
  listening = false,
  captureBusy = false,
  showIntroduction = true,
  connectionHelp,
  renderModelControls = controls => controls,
  useView,
}: Props & { useView: () => ViewState }) => {
  const state = useView();
  const { rules, turns, result, request } = state;
  const busy = request.phase !== 'idle';
  const [selected, setSelected] = useState<string>();
  const [sourceItem, setSourceItem] = useState<string>();
  const [editing, setEditing] = useState<{ id: string; text: string }>();
  const [removed, setRemoved] = useState<string>();
  const [copyFallback, setCopyFallback] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState('');
  const sampleOnly = turns.length > 0 && turns.every(turn => turn.sourceId === 'sample');
  const active = result?.rules.find(rule => rule.id === selected) ?? result?.rules[0];
  const items = result?.items.filter(item => item.listId === active?.id && !item.hidden) ?? [];
  const invalidRules = rules.some(rule => rule.preset === 'Custom' && !rule.instructions.trim());

  useEffect(() => {
    runtime.cancel(true);
    return () => runtime.cancel();
  }, [runtime, connect]);
  useEffect(() => {
    if (listening) runtime.cancel();
  }, [runtime, listening]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.markdown);
      setMessage('Lists copied as Markdown.');
    } catch {
      setCopyFallback(true);
      setMessage('Copy the Markdown from the field below.');
    }
  };
  const reset = () => {
    runtime.clear();
    setEditing(undefined);
    setRemoved(undefined);
    setSourceItem(undefined);
    setCopyFallback(false);
    setConfirmClear(false);
    setMessage('Dictation and lists cleared. Microphone is off.');
  };
  return (
    <section className="list-extraction" aria-label="List extraction">
      {showIntroduction && (
        <header className="extraction-intro">
          <h1>List extraction</h1>
          <p>Tell it what to keep. Speak freely and collect selective lists.</p>
        </header>
      )}
      <p className="extraction-hint">
        Dictation stays on this device. Choose Extract lists to send finalized transcript text to
        your selected model.
      </p>
      <section className="extraction-setup" aria-label="Extraction rules">
        {rules.map((rule, index) => (
          <RuleEditor
            key={rule.id}
            rule={rule}
            index={index}
            count={rules.length}
            disabled={false}
            onChange={next =>
              runtime.setRules(rules.map(existing => (existing.id === rule.id ? next : existing)))
            }
            onRemove={() => runtime.setRules(rules.filter(existing => existing.id !== rule.id))}
          />
        ))}
        <button
          type="button"
          className="extraction-quiet extraction-add"
          disabled={rules.length >= 6}
          onClick={() => {
            const preset =
              (['Decisions', 'Questions', 'Ideas and proposals', 'Commitments'] as const).find(
                preset => !rules.some(rule => rule.preset === preset)
              ) ?? 'Custom';
            runtime.setRules([
              ...rules,
              {
                id: crypto.randomUUID(),
                preset,
                name: preset === 'Custom' ? 'Custom list' : preset,
                wording: 'clean',
                instructions: '',
              },
            ]);
          }}
        >
          + Add another list
        </button>
        {invalidRules && (
          <p className="extraction-hint">
            Add instructions for each custom list before extracting.
          </p>
        )}
      </section>

      {!sampleOnly && controls}
      {sampleOnly && (
        <div className="extraction-sample-notice">
          <p className="extraction-hint">You’re reviewing the built-in sample.</p>
          <button
            type="button"
            className="site-button"
            disabled={listening || captureBusy}
            onClick={reset}
          >
            Use my own dictation
          </button>
        </div>
      )}
      {renderModelControls(
        <section className="extraction-model" aria-label="Extraction connection">
          <div className="extraction-actions">
            <button
              type="button"
              className="site-button site-button--blue extraction-primary"
              disabled={
                !connect ||
                !turns.length ||
                listening ||
                captureBusy ||
                busy ||
                !!request.error?.policy.terminal ||
                invalidRules
              }
              onClick={() => {
                setRemoved(undefined);
                setCopyFallback(false);
                if (connect) void runtime.extract(connect);
              }}
            >
              {request.phase === 'connecting'
                ? 'Connecting…'
                : request.phase === 'extracting'
                  ? 'Extracting…'
                  : 'Extract lists'}
            </button>
            {busy && (
              <button type="button" className="site-button" onClick={() => runtime.cancel()}>
                Cancel extraction
              </button>
            )}
            {!busy &&
              !listening &&
              !captureBusy &&
              ((!turns.length && !state.current && !state.provisional) || sampleOnly) && (
                <button
                  type="button"
                  className="extraction-quiet"
                  onClick={() => {
                    runtime.loadSample();
                    setRemoved(undefined);
                    setMessage(
                      'Built-in sample results. No transcript was sent to a model. Custom instructions have no sample results.'
                    );
                  }}
                >
                  {sampleOnly ? 'Refresh sample' : 'Try sample'}
                </button>
              )}
            {!busy && (
              <span className="extraction-status-hint">
                {listening || captureBusy
                  ? 'Stop listening to extract the complete dictation.'
                  : 'Extraction runs only when you choose it.'}
              </span>
            )}
          </div>
          {!connect &&
            (connectionHelp ?? (
              <p className="extraction-hint">
                No model connection is configured. You can still dictate locally or try the sample.
              </p>
            ))}
          {request.error && (
            <p role="alert" className="extraction-error">
              {request.error.message}
            </p>
          )}
        </section>
      )}

      <div className="extraction-layout">
        <section className="extraction-output" aria-label="Extracted lists">
          <div className="extraction-output-heading">
            <h2>Your lists</h2>
            <button
              type="button"
              className="site-button"
              disabled={!result}
              onClick={() => void copy()}
            >
              Copy Markdown
            </button>
          </div>
          {state.stale && (
            <p className="extraction-hint">
              Setup or dictation has changed. These are the previous results; Extract lists replaces
              them using the current setup.
            </p>
          )}
          {result?.sample && (
            <p className="extraction-hint">
              Sample results. Unrelated speech about headphones was left out.
            </p>
          )}
          {!!result && result.rules.length > 1 && (
            <div className="extraction-tabs" aria-label="Extracted list selection">
              {result.rules.map(rule => (
                <button
                  type="button"
                  key={rule.id}
                  aria-pressed={active?.id === rule.id}
                  onClick={() => setSelected(rule.id)}
                >
                  {rule.name}{' '}
                  <span>
                    {result.items.filter(item => item.listId === rule.id && !item.hidden).length}
                  </span>
                </button>
              ))}
            </div>
          )}
          {!result ? (
            <div className="extraction-empty">
              <p>Only the items you ask for will appear here.</p>
              <p>Try describing a project, or use the sample to see what gets kept.</p>
            </div>
          ) : !items.length ? (
            <p className="extraction-empty">
              No matching items in {active?.name}.{' '}
              {result.sample && 'The sample covers built-in presets without custom instructions.'}
            </p>
          ) : (
            items.map(item => (
              <article className="extraction-item" key={item.id}>
                {editing?.id === item.id ? (
                  <form
                    onSubmit={event => {
                      event.preventDefault();
                      if (!editing.text.trim()) return;
                      runtime.edit(item.id, editing.text.trim());
                      setEditing(undefined);
                    }}
                  >
                    <label className="extraction-field">
                      Item text
                      <textarea
                        value={editing.text}
                        maxLength={2000}
                        rows={2}
                        onChange={event => setEditing({ id: item.id, text: event.target.value })}
                      />
                    </label>
                    <div className="extraction-actions">
                      <button type="submit" disabled={!editing.text.trim()}>
                        Save
                      </button>
                      <button type="button" onClick={() => setEditing(undefined)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="extraction-item-text">{item.text}</p>
                )}
                <p className="extraction-item-meta">
                  {[item.kind, item.owner, item.deadline].filter(Boolean).join(' / ')}
                </p>
                <div className="extraction-item-actions">
                  <button
                    type="button"
                    className="extraction-quiet"
                    aria-expanded={sourceItem === item.id}
                    onClick={() => setSourceItem(sourceItem === item.id ? undefined : item.id)}
                  >
                    {sourceItem === item.id ? 'Hide source' : 'Show source'}
                  </button>
                  <button
                    type="button"
                    className="extraction-quiet"
                    onClick={() => setEditing({ id: item.id, text: item.text })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="extraction-quiet"
                    onClick={() => {
                      runtime.setHidden(item.id, true);
                      setRemoved(item.id);
                    }}
                  >
                    Remove
                  </button>
                </div>
                {sourceItem === item.id && (
                  <div className="extraction-evidence">
                    {item.sources.map((source, index) => {
                      const turn = turns.find(turn => turn.id === source.turnId);
                      return (
                        <div key={index}>
                          <time>
                            {formatTime(turn?.startMs)}
                            {turn?.endMs === undefined ? '' : ` to ${formatTime(turn.endMs)}`}
                          </time>
                          {turn?.speaker && <p>{turn.speaker}</p>}
                          <blockquote>{source.quote}</blockquote>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            ))
          )}
          {removed && result?.items.some(item => item.id === removed && item.hidden) && (
            <button
              type="button"
              className="extraction-quiet"
              onClick={() => {
                runtime.setHidden(removed, false);
                setRemoved(undefined);
              }}
            >
              Undo removal
            </button>
          )}
          {copyFallback && (
            <label className="extraction-field extraction-copy">
              Markdown
              <textarea
                readOnly
                rows={8}
                value={state.markdown}
                onFocus={event => event.currentTarget.select()}
              />
            </label>
          )}
        </section>
        <TranscriptTurns turns={turns} current={state.current} provisional={state.provisional} />
      </div>
      <p className="extraction-message" role="status" aria-live="polite">
        {busy
          ? request.phase === 'connecting'
            ? 'Connecting to the model…'
            : 'Extracting the requested lists…'
          : message}
      </p>
      {!sampleOnly && (!!turns.length || !!state.current || !!state.provisional) && (
        <div className="extraction-new">
          {confirmClear ? (
            <>
              <p>This clears the current dictation and lists from view. Continue?</p>
              <button type="button" disabled={listening || captureBusy} onClick={reset}>
                Clear dictation
              </button>
              <button type="button" onClick={() => setConfirmClear(false)}>
                Keep dictation
              </button>
            </>
          ) : (
            <button
              type="button"
              className="extraction-quiet"
              disabled={listening || captureBusy}
              onClick={() => setConfirmClear(true)}
            >
              New dictation
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export const ListExtractionDemo = (props: Props) => {
  const [useView, view$] = useMemo(() => bind(props.runtime.state$), [props.runtime]);
  return (
    <Subscribe source$={view$}>
      <ExtractionView {...props} useView={useView} />
    </Subscribe>
  );
};
