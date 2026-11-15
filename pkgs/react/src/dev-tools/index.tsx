'use client';

import { useEffect, useState } from 'react';
import { formatValue } from './formatValue';
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './ui';

/** Compatible with RxJS observables, including properties and replaying event logs. */
export type InspectionSource = {
  subscribe: (observer: {
    next: (value: unknown) => void;
    error: (error: unknown) => void;
    complete: () => void;
  }) => { unsubscribe: () => void };
  get?: () => unknown;
};

export type ObservableInspectorProps = {
  name: string;
  source: InspectionSource;
};

type Snapshot = {
  latest?: string;
  history: string[];
  status: 'waiting' | 'live' | 'complete' | 'error';
  error?: string;
};

const emptySnapshot = (): Snapshot => ({ history: [], status: 'waiting' });

/** A read-only latest-value and recent-emission view. Subscribes only while mounted. */
export const ObservableInspector = ({ name, source }: ObservableInspectorProps) => {
  const [snapshot, setSnapshot] = useState(emptySnapshot);

  useEffect(() => {
    let active = true;
    setSnapshot(emptySnapshot());
    const fail = (error: unknown) => {
      if (active) {
        setSnapshot(previous => ({ ...previous, status: 'error', error: formatValue(error) }));
      }
    };
    let subscription: ReturnType<InspectionSource['subscribe']> | undefined;
    try {
      if (source.get) {
        const latest = formatValue(source.get());
        setSnapshot({ latest, history: [], status: 'waiting' });
      }
      subscription = source.subscribe({
        next: value => {
          if (!active) return;
          const latest = formatValue(value);
          setSnapshot(previous => ({
            latest,
            history: [latest, ...previous.history].slice(0, 50),
            status: 'live',
          }));
        },
        error: fail,
        complete: () => {
          if (active) setSnapshot(previous => ({ ...previous, status: 'complete' }));
        },
      });
    } catch (error) {
      fail(error);
    }
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [source]);

  return (
    <section className="kk-devtools kk-devtools-inspector" aria-label={`${name} inspector`}>
      <div className="kk-devtools-heading">
        <strong>{name}</strong>
        <span className="kk-devtools-status">{snapshot.status}</span>
      </div>
      {snapshot.error && <pre role="alert">{snapshot.error}</pre>}
      <Tabs defaultValue="latest">
        <TabsList aria-label={`${name} views`}>
          <TabsTrigger value="latest">Latest value</TabsTrigger>
          <TabsTrigger value="history">Recent emissions ({snapshot.history.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="latest">
          <pre>{snapshot.latest ?? 'Waiting for a value…'}</pre>
        </TabsContent>
        <TabsContent value="history">
          <p className="kk-devtools-hint">
            Newest first · up to 50 emissions per mounted inspector
          </p>
          {snapshot.history.length ? (
            <ol className="kk-devtools-history">
              {snapshot.history.map((value, index) => (
                <li key={index}>
                  <pre>{value}</pre>
                </li>
              ))}
            </ol>
          ) : (
            <p className="kk-devtools-hint">No emissions received.</p>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
};

export type DevToolsProps = {
  observables: Record<string, InspectionSource>;
};

/** Collapsed by default. The application controls development-only loading and rendering. */
export const DevTools = ({ observables }: DevToolsProps) => {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible className="kk-devtools kk-devtools-root" open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger render={<Button />}>
        {open ? 'Hide developer tools' : 'Show developer tools'}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {open && (
          <div className="kk-devtools-body">
            <p className="kk-devtools-hint">Read-only observable inspection</p>
            {Object.entries(observables).map(([name, source]) => (
              <ObservableInspector key={name} name={name} source={source} />
            ))}
            {!Object.keys(observables).length && <p>No observables configured.</p>}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
