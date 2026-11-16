'use client';

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { DevTools, type DevToolsProps } from './index';

export { createDevToolsStore } from './store';
export type { DevToolsStore } from './store';
export type { DevToolsProps } from './index';
export type { TranscriptInspection } from './TranscriptView';

/** Lifecycle handle for a workbench mounted without a host React tree. */
export type MountedDevTools = {
  /** Update the transcript binding or host-owned microphone state without resetting the view or drafts. */
  update: (options: Pick<DevToolsProps, 'transcript'>) => void;
  /** Release the React root and inspection subscriptions and remove only the owned child element. Idempotent. */
  unmount: () => void;
};

const mounts = new WeakMap<HTMLElement, MountedDevTools>();

/**
 * Mount the workbench inside a host DOM element, without JSX or React root setup.
 * Import `@katakit/react/dev-tools.css` separately. The container's existing children
 * are preserved. One mount is allowed per container; call unmount() before reusing it.
 * The runtime and capture store stay fixed for this mount and remain host-owned.
 * Rendering follows React's scheduling. Unmounting never stops the runtime,
 * microphone, or tracing SDK, and does not clear the supplied store's history.
 */
export const mountDevTools = (container: HTMLElement, options: DevToolsProps): MountedDevTools => {
  if (mounts.has(container))
    throw new Error('A developer workbench is already mounted in this container');
  const element = container.ownerDocument.createElement('div');
  container.append(element);
  const root = createRoot(element);
  let mounted = true;
  let props = { ...options };
  const handle: MountedDevTools = {
    update: next => {
      if (!mounted) throw new Error('Cannot update an unmounted developer workbench');
      if ('transcript' in next) props = { ...props, transcript: next.transcript };
      root.render(createElement(DevTools, props));
    },
    unmount: () => {
      if (!mounted) return;
      mounted = false;
      try {
        root.unmount();
      } finally {
        element.remove();
        mounts.delete(container);
      }
    },
  };
  mounts.set(container, handle);
  root.render(createElement(DevTools, props));
  return handle;
};
