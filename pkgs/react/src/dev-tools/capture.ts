import { useLayoutEffect, useSyncExternalStore } from 'react';
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
  let frame: number | undefined;

  const publish = () => {
    frame = undefined;
    snapshot = [...snapshot, ...pending].slice(-retentionLimit);
    pending = [];
    listeners.forEach(notify => notify());
  };
  const attach = () => {
    stop ??= installRecorder(event => {
      if (pending.length === retentionLimit) pending.shift();
      pending.push(event);
      frame ??= requestAnimationFrame(publish);
    });
    owners++;
    return () => {
      owners--;
      // A synchronous Strict Mode remount can reclaim the same recording.
      queueMicrotask(() => {
        if (owners || !stop) return;
        stop();
        stop = undefined;
        if (frame !== undefined) cancelAnimationFrame(frame);
        frame = undefined;
        pending = [];
        snapshot = empty;
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
  useLayoutEffect(store.attach, []);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => empty);
};
