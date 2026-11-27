import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { installRecorder, type Delivery } from './deliveries';

const empty: readonly Delivery[] = [];
const retentionLimit = 500;

// All mounted panels share one recorder. React owns each panel's layout-effect
// lease; the last release discards the recording, including any unpublished frame.
const createCaptureStore = () => {
  const listeners = new Set<() => void>();
  let snapshot = empty;
  let pending: Delivery[] = [];
  let stop: (() => void) | undefined;
  let owners = 0;
  let panels = new WeakSet<object>();
  let frame: number | undefined;

  const publish = () => {
    frame = undefined;
    snapshot = [...snapshot, ...pending].slice(-retentionLimit);
    pending = [];
    listeners.forEach(notify => notify());
  };
  const discardRecording = () => {
    stop?.();
    stop = undefined;
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    pending = [];
    snapshot = empty;
    panels = new WeakSet();
  };
  const attach = (panel: object) => {
    // Only a returning panel (e.g. a Strict Mode effect replay) can reclaim an
    // ownerless recording. A new keyed demo may mount in the very same commit.
    if (!owners && stop && !panels.has(panel)) discardRecording();
    panels.add(panel);
    stop ??= installRecorder(event => {
      if (pending.length === retentionLimit) pending.shift();
      pending.push(event);
      frame ??= requestAnimationFrame(publish);
    });
    owners++;
    return () => {
      owners--;
      queueMicrotask(() => {
        if (!owners && stop) discardRecording();
      });
    };
  };
  return {
    attach,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
const store = createCaptureStore();
export const useCapture = () => {
  const panel = useRef(null);
  useLayoutEffect(() => store.attach(panel), []);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => empty);
};
