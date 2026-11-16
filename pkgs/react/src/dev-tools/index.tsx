'use client';

import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import {
  createWorkbenchSurface,
  getInlineSnapshot,
  subscribeInline,
  WorkbenchSurfaceContext,
  type WorkbenchSurface,
  type DevToolsPopoutOptions,
} from './surface';
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
export type { DevToolsPopoutOptions } from './surface';

export type DevToolsProps = {
  runtime: AliveKatakit;
  store: DevToolsStore;
  transcript?: TranscriptInspection;
  /** Popout controls are enabled by default. Supply a host window factory, or false to disable. */
  popout?: DevToolsPopoutOptions | false;
};

/** Inline or popped-out workbench. Capture and UI state survive docking and window changes. */
export const DevTools = ({ runtime, store, transcript, popout }: DevToolsProps) => {
  const anchor = useRef<HTMLDivElement>(null);
  const providedSurface = useContext(WorkbenchSurfaceContext);
  const [surface, setSurface] = useState<WorkbenchSurface | undefined>(providedSurface);
  useLayoutEffect(() => {
    if (!anchor.current) return;
    const current = providedSurface ?? createWorkbenchSurface(anchor.current.ownerDocument);
    current.attach(anchor.current);
    setSurface(current);
    return () => {
      if (!providedSurface) current.dispose();
    };
  }, [providedSurface]);
  const windowState = useSyncExternalStore(
    surface?.subscribe ?? subscribeInline,
    surface?.getSnapshot ?? getInlineSnapshot,
    getInlineSnapshot
  );
  useEffect(() => {
    if (popout === false) surface?.dock();
  }, [popout, surface]);
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
  const content = (
    <Collapsible
      className="kk-devtools kk-workbench"
      open={open || windowState.detached}
      onOpenChange={setOpen}
    >
      <header className="kk-workbench-header">
        {windowState.detached ? (
          <strong>Developer workbench</strong>
        ) : (
          <CollapsibleTrigger render={<Button />}>
            <span className="kk-live-dot" />
            {open ? 'Hide developer workbench' : 'Open developer workbench'}
          </CollapsibleTrigger>
        )}
        <span className="kk-capture-status">Capturing · {snapshot.activity.length} retained</span>
        <Button onClick={store.clear}>Clear captured history</Button>
        {windowState.detached ? (
          <Button onClick={surface?.dock}>Dock workbench</Button>
        ) : (
          popout !== false && (
            <Button onClick={() => surface?.popOut(popout)}>Pop out workbench</Button>
          )
        )}
      </header>
      {windowState.error && (
        <p role="alert" className="kk-window-error">
          {windowState.error}
        </p>
      )}
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
  return (
    <div ref={anchor} tabIndex={-1}>
      {windowState.detached && (
        <div className="kk-devtools kk-popout-placeholder" role="status">
          <span>Developer workbench is open in a separate window. Capture continues.</span>
          <Button onClick={surface?.focus}>Focus workbench window</Button>
          <Button onClick={surface?.dock}>Dock workbench</Button>
        </div>
      )}
      {surface && createPortal(content, surface.element)}
    </div>
  );
};
