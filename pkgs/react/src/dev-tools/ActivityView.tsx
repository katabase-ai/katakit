import { useEffect, useMemo, useState } from 'react';
import type { PluginInspection } from '@katakit/core';
import type { ActivityEntry } from './store';
import { Button } from './ui';
import { CopyValue } from './StateView';

const laneKey = (entry: { plugin: string; kind: string; name: string; effectIndex?: number }) =>
  JSON.stringify([
    entry.plugin,
    entry.kind,
    entry.kind === 'effect' ? entry.effectIndex : entry.name,
  ]);
const duration = (entry: ActivityEntry, now: number) =>
  `${Math.max(0, (entry.end ?? now) - entry.start).toFixed(1)} ms`;

export const ActivityView = ({
  plugins,
  activity,
}: {
  plugins: PluginInspection[];
  activity: ActivityEntry[];
}) => {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [hidden, setHidden] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [follow, setFollow] = useState(true);
  const [pausedIds, setPausedIds] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now);
  const running = activity.some(entry => entry.outcome === 'running');
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [running]);
  const lanes = useMemo(
    () =>
      plugins.flatMap(plugin => [
        ...Object.keys(plugin.observables).map(name => ({
          plugin: plugin.type,
          kind: 'emission',
          name,
        })),
        ...plugin.methods.map(name => ({ plugin: plugin.type, kind: 'method', name })),
        ...plugin.effects.map(effect => ({
          plugin: plugin.type,
          kind: 'effect',
          effectIndex: effect.index,
          name: effect.name ?? `effect ${effect.index}`,
        })),
      ]),
    [plugins]
  );
  const matches = (entry: { plugin: string; kind: string; name: string }) =>
    (kind === 'all' || entry.kind === kind) &&
    `${entry.plugin} ${entry.name}`.toLowerCase().includes(search.toLowerCase());
  const visibleLanes = lanes.filter(lane => !hidden.includes(laneKey(lane)) && matches(lane));
  const visibleKeys = new Set(visibleLanes.map(laneKey));
  const visible = activity.filter(
    entry => visibleKeys.has(laneKey(entry)) && (follow || pausedIds.includes(entry.id))
  );
  const first = Math.min(...visible.map(entry => entry.start), Date.now());
  const last = Math.max(
    first + 1,
    ...visible.map(entry => entry.end ?? (entry.kind === 'emission' ? entry.start : now))
  );
  const selected = activity.find(entry => entry.id === selectedId);
  const parent = selected?.parentSpanId
    ? activity.find(
        entry => entry.spanId === selected.parentSpanId && entry.traceId === selected.traceId
      )
    : undefined;
  const children = selected?.spanId
    ? activity.filter(
        entry => entry.parentSpanId === selected.spanId && entry.traceId === selected.traceId
      )
    : [];

  return (
    <>
      <div className="kk-toolbar">
        <label className="kk-search">
          Search activity
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Method, effect, or observable"
          />
        </label>
        <label>
          Kind
          <select value={kind} onChange={event => setKind(event.target.value)}>
            <option value="all">All activity</option>
            <option value="method">Methods</option>
            <option value="effect">Effects</option>
            <option value="emission">Emissions</option>
          </select>
        </label>
        <label className="kk-check">
          <input
            type="checkbox"
            checked={follow}
            onChange={event => {
              setFollow(event.target.checked);
              if (!event.target.checked) setPausedIds(activity.map(entry => entry.id));
            }}
          />
          Follow live
        </label>
      </div>
      {!follow && (
        <p className="kk-hint">
          View paused. Capture continues; enable Follow live to show new records.
        </p>
      )}
      <details className="kk-tracks">
        <summary>
          Tracks · {visibleLanes.length} shown / {lanes.length} declared
        </summary>
        <div className="kk-track-options">
          {lanes.map(lane => (
            <label className="kk-check" key={laneKey(lane)}>
              <input
                type="checkbox"
                checked={!hidden.includes(laneKey(lane))}
                onChange={event =>
                  setHidden(previous =>
                    event.target.checked
                      ? previous.filter(key => key !== laneKey(lane))
                      : [...previous, laneKey(lane)]
                  )
                }
              />
              <span>
                <small>
                  {lane.plugin} · {lane.kind}
                </small>
                <code>{lane.name}</code>
              </span>
            </label>
          ))}
        </div>
      </details>
      <div className="kk-timeline" role="group" aria-label="Activity timeline">
        <div className="kk-section-heading">
          <h3>Timeline</h3>
          <span className="kk-muted">
            {((last - first) / 1000).toFixed(2)} s window · emission times are observed locally
          </span>
        </div>
        <div className="kk-lanes">
          {visibleLanes.map(lane => (
            <div className="kk-lane" key={laneKey(lane)}>
              <div className="kk-lane-label">
                <small>
                  {lane.plugin} · {lane.kind}
                </small>
                <code title={lane.name}>{lane.name}</code>
              </div>
              <div className="kk-lane-plot">
                {visible
                  .filter(entry => laneKey(entry) === laneKey(lane))
                  .map(entry => (
                    <button
                      type="button"
                      key={entry.id}
                      className="kk-span"
                      data-kind={entry.kind}
                      data-outcome={entry.outcome}
                      aria-label={`Inspect ${entry.plugin} ${entry.name} ${entry.kind}`}
                      title={`${entry.name} · ${entry.kind === 'emission' ? 'observed emission' : duration(entry, now)}`}
                      style={{
                        left: `${Math.min(98, ((entry.start - first) / (last - first)) * 100)}%`,
                        width:
                          entry.kind === 'emission'
                            ? '6px'
                            : `${Math.max(1, (((entry.end ?? now) - entry.start) / (last - first)) * 100)}%`,
                      }}
                      onClick={() => setSelectedId(entry.id)}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
        {!visible.length && (
          <p className="kk-empty">
            No activity captured for these tracks. Declared capabilities remain selectable before
            their first call.
          </p>
        )}
      </div>
      <div className="kk-activity-layout">
        <section className="kk-card" aria-label="Activity records">
          <div className="kk-section-heading">
            <h3>Records</h3>
            <span className="kk-muted">{visible.length} retained</span>
          </div>
          <div
            className="kk-records"
            ref={node => {
              if (node && follow) node.scrollTop = 0;
            }}
          >
            {visible.map(entry => (
              <button
                type="button"
                key={entry.id}
                className="kk-record"
                data-selected={selectedId === entry.id}
                onClick={() => setSelectedId(entry.id)}
              >
                <span className="kk-kind" data-kind={entry.kind}>
                  {entry.kind}
                </span>
                <span>
                  <strong>{entry.name}</strong>
                  <small>{entry.plugin}</small>
                </span>
                <span className="kk-record-end">
                  <span className="kk-status" data-outcome={entry.outcome}>
                    {entry.kind === 'emission' ? 'observed' : entry.outcome}
                  </span>
                  <small>
                    {entry.kind === 'emission'
                      ? new Date(entry.start).toLocaleTimeString()
                      : duration(entry, now)}
                  </small>
                </span>
              </button>
            ))}
            {!visible.length && (
              <p className="kk-empty">
                Exercise the application or submit a transcript segment to see activity here.
              </p>
            )}
          </div>
        </section>
        <aside className="kk-card kk-detail" aria-label="Activity details">
          <div className="kk-section-heading">
            <h3>Details</h3>
            {selected && <Button onClick={() => setSelectedId(undefined)}>Close</Button>}
          </div>
          {!selected ? (
            <p className="kk-empty">
              {selectedId
                ? 'This record is no longer retained.'
                : 'Select an invocation or emission to inspect it.'}
            </p>
          ) : (
            <>
              <h4>
                {selected.plugin} / {selected.name}
              </h4>
              <dl>
                <dt>Kind</dt>
                <dd>{selected.kind}</dd>
                <dt>Outcome</dt>
                <dd>{selected.outcome}</dd>
                <dt>Started</dt>
                <dd>{new Date(selected.start).toLocaleTimeString()}</dd>
                {selected.kind !== 'emission' && (
                  <>
                    <dt>Duration</dt>
                    <dd>{duration(selected, now)}</dd>
                  </>
                )}
                {selected.errorType && (
                  <>
                    <dt>Failure type</dt>
                    <dd>{selected.errorType}</dd>
                  </>
                )}
                {selected.spanId && (
                  <>
                    <dt>Span ID</dt>
                    <dd>
                      <code>{selected.spanId}</code>
                    </dd>
                  </>
                )}
                {selected.traceId && (
                  <>
                    <dt>Trace ID</dt>
                    <dd>
                      <code>{selected.traceId}</code>
                    </dd>
                  </>
                )}
              </dl>
              {selected.parentSpanId && (
                <>
                  <h4>
                    {selected.kind === 'emission' ? 'Observed in active span' : 'Parent invocation'}
                  </h4>
                  {parent ? (
                    <Button onClick={() => setSelectedId(parent.id)}>
                      {parent.plugin}.{parent.name}
                    </Button>
                  ) : (
                    <p className="kk-hint">{selected.parentSpanId} · outside retained history</p>
                  )}
                </>
              )}
              {!!children.length && (
                <>
                  <h4>Related child records</h4>
                  {children.map(child => (
                    <Button key={child.id} onClick={() => setSelectedId(child.id)}>
                      {child.kind} · {child.name}
                    </Button>
                  ))}
                </>
              )}
              {selected.value !== undefined && (
                <>
                  <div className="kk-section-heading">
                    <h4>Observed value</h4>
                    <CopyValue value={selected.value} />
                  </div>
                  <pre>{selected.value}</pre>
                </>
              )}
              <p className="kk-hint">
                Invocation payloads are not recorded. Completed calls can have no state change.
              </p>
            </>
          )}
        </aside>
      </div>
    </>
  );
};
