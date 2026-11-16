'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { AliveKatakit } from '@katakit/core';
import { ActivityView } from './ActivityView';
import { StateView } from './StateView';
import { TranscriptView, type TranscriptInspection } from './TranscriptView';
import { type DevToolsStore } from './store';
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

export { createDevToolsStore } from './store';
export type { DevToolsStore, DevToolsSnapshot, ActivityEntry, InspectedValue } from './store';
export type { TranscriptInspection } from './TranscriptView';

export type DevToolsProps = {
  runtime: AliveKatakit;
  store: DevToolsStore;
  transcript?: TranscriptInspection;
};

/** Inline workbench. Host-owned capture remains attached while the panel is collapsed. */
export const DevTools = ({ runtime, store, transcript }: DevToolsProps) => {
  const [open, setOpen] = useState(false);
  const [pluginType, setPluginType] = useState('all');
  const [view, setView] = useState('activity');
  const inventory = useMemo(() => runtime.inspect(), [runtime]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => store.connect(runtime), [runtime, store]);
  const plugins = useMemo(
    () => inventory.plugins.filter(plugin => pluginType === 'all' || plugin.type === pluginType),
    [inventory, pluginType]
  );
  const spans = snapshot.activity.filter(entry => entry.kind !== 'emission').length;
  return (
    <Collapsible className="kk-devtools kk-workbench" open={open} onOpenChange={setOpen}>
      <header className="kk-workbench-header">
        <CollapsibleTrigger render={<Button />}>
          <span className="kk-live-dot" />
          {open ? 'Hide developer workbench' : 'Open developer workbench'}
        </CollapsibleTrigger>
        <span className="kk-capture-status">Capturing · {snapshot.activity.length} retained</span>
        <Button onClick={store.clear}>Clear captured history</Button>
      </header>
      <CollapsibleContent keepMounted>
        <div className="kk-workbench-layout">
          <nav className="kk-plugin-nav" aria-label="Runtime plugins">
            <h2>Runtime</h2>
            <Button aria-pressed={pluginType === 'all'} onClick={() => setPluginType('all')}>
              All plugins<small>{inventory.plugins.length} configured</small>
            </Button>
            {inventory.plugins.map(plugin => (
              <Button
                key={plugin.type}
                aria-pressed={pluginType === plugin.type}
                onClick={() => setPluginType(plugin.type)}
              >
                {plugin.type}
                <small>
                  {Object.keys(plugin.observables).length} observables · {plugin.methods.length}{' '}
                  methods · {plugin.effects.length} effects
                </small>
              </Button>
            ))}
            {!inventory.plugins.length && <p className="kk-hint">No plugins configured.</p>}
            <p className="kk-hint">
              {inventory.tracing
                ? spans
                  ? `${spans} invocation spans retained`
                  : 'Instrumentation enabled. No SDK spans captured yet.'
                : 'Trace instrumentation disabled for this runtime.'}
            </p>
          </nav>
          <div className="kk-workbench-main">
            <Tabs
              value={view === 'transcript' && !transcript ? 'activity' : view}
              onValueChange={setView}
            >
              <TabsList aria-label="Workbench views">
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="state">State & capabilities</TabsTrigger>
                {transcript && <TabsTrigger value="transcript">Transcript & input</TabsTrigger>}
              </TabsList>
              <TabsContent value="activity" keepMounted>
                <ActivityView plugins={plugins} activity={snapshot.activity} />
              </TabsContent>
              <TabsContent value="state" keepMounted>
                <StateView plugins={plugins} snapshot={snapshot} tracing={inventory.tracing} />
              </TabsContent>
              {transcript && (
                <TabsContent value="transcript" keepMounted>
                  <TranscriptView binding={transcript} />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
        <footer className="kk-workbench-footer">
          <span>
            Local inspection · {snapshot.activity.length} / {store.capacity} records retained
            {snapshot.omitted ? ` · ${snapshot.omitted} older records omitted` : ''}
          </span>
          <span>Clear affects captured history only.</span>
        </footer>
      </CollapsibleContent>
    </Collapsible>
  );
};
