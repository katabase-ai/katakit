import { useLayoutEffect, useSyncExternalStore } from 'react';
import { installRecorder, type Delivery } from './deliveries';

const empty: readonly Delivery[] = [];
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
let snapshot = empty;
let pending: Delivery[] = [];
let stop: (() => void) | undefined;
let owners = 0;
let frame = 0;

const publish = () => {
  frame = 0;
  snapshot = [...snapshot, ...pending].slice(-500);
  pending = [];
  listeners.forEach(notify => notify());
};
const attach = () => {
  owners++;
  stop ??= installRecorder(event => {
    if (pending.length === 500) pending.shift();
    pending.push(event);
    frame ||= requestAnimationFrame(publish);
  });
  return () => {
    owners--;
    // Keep the same recorder across React's synchronous Strict Mode remount.
    queueMicrotask(() => {
      if (owners || !stop) return;
      stop();
      stop = undefined;
      cancelAnimationFrame(frame);
      frame = 0;
      pending = [];
      snapshot = empty;
    });
  };
};
export const useCapture = () => {
  useLayoutEffect(attach, []);
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => empty
  );
};
