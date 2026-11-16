import { useState } from 'react';
import type { PluginInspection } from '@katakit/core';
import type { DevToolsSnapshot } from './store';
import { observableKey } from './store';
import { Button } from './ui';

export const CopyValue = ({ value }: { value: string }) => {
  const [status, setStatus] = useState('Copy');
  return (
    <Button
      onClick={async event => {
        try {
          const clipboard = event.currentTarget.ownerDocument.defaultView?.navigator.clipboard;
          if (!clipboard) throw new Error('Clipboard unavailable');
          await clipboard.writeText(value);
          setStatus('Copied');
        } catch {
          setStatus('Copy unavailable');
        }
      }}
    >
      {status}
    </Button>
  );
};

export const StateView = ({
  plugins,
  snapshot,
  tracing,
}: {
  plugins: PluginInspection[];
  snapshot: DevToolsSnapshot;
  tracing: boolean;
}) => (
  <div className="kk-state-grid">
    {plugins.map(plugin => (
      <section key={plugin.type} className="kk-card" aria-label={`${plugin.type} capabilities`}>
        <div className="kk-section-heading">
          <h3>{plugin.type}</h3>
          <span className="kk-muted">
            {tracing ? 'Trace instrumentation enabled' : 'Tracing disabled'}
          </span>
        </div>
        <h4>Observables</h4>
        {Object.keys(plugin.observables).length ? (
          Object.keys(plugin.observables).map(name => {
            const current = snapshot.values[observableKey(plugin.type, name)];
            return (
              <details key={name} className="kk-value" open>
                <summary>
                  <code>{name}</code>
                  <span
                    className="kk-status"
                    data-outcome={current?.status === 'failed' ? 'failed' : undefined}
                  >
                    {current?.status ?? 'waiting'}
                  </span>
                </summary>
                <div className="kk-value-actions">
                  {current?.value !== undefined && <CopyValue value={current.value} />}
                </div>
                <pre>{current?.value ?? 'Waiting for a value…'}</pre>
              </details>
            );
          })
        ) : (
          <p className="kk-muted">No observables declared.</p>
        )}
        <h4>Methods</h4>
        <p className="kk-hint">Available methods · calls are inspected in Activity</p>
        <ul className="kk-capabilities">
          {plugin.methods.map(name => (
            <li key={name}>
              <code>{name}</code>
              <span>
                {
                  snapshot.activity.filter(
                    entry =>
                      entry.plugin === plugin.type && entry.kind === 'method' && entry.name === name
                  ).length
                }{' '}
                captured calls
              </span>
            </li>
          ))}
        </ul>
        {!plugin.methods.length && <p className="kk-muted">No methods declared.</p>}
        <h4>Effects</h4>
        <ul className="kk-capabilities">
          {plugin.effects.map(effect => (
            <li key={effect.index}>
              <code>{effect.name ?? `effect ${effect.index}`}</code>
              <span>
                {effect.backpressure} ·{' '}
                {
                  snapshot.activity.filter(
                    entry =>
                      entry.plugin === plugin.type &&
                      entry.kind === 'effect' &&
                      entry.effectIndex === effect.index
                  ).length
                }{' '}
                captured calls
              </span>
            </li>
          ))}
        </ul>
        {!plugin.effects.length ? (
          <p className="kk-muted">No effects declared.</p>
        ) : (
          <p className="kk-hint">
            Effect trigger conditions are not described by the runtime. Emission markers and handler
            execution are separate observations.
          </p>
        )}
      </section>
    ))}
  </div>
);
