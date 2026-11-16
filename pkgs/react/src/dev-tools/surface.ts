import { createContext } from 'react';

/** Optional host window factory. Return a new blank same-origin window synchronously, or null if unavailable. */
export type DevToolsPopoutOptions = {
  openWindow?: (sourceWindow: Window) => Window | null;
};

const inlineSnapshot = { detached: false, error: '' };

/** One persistent portal target, moved between documents without remounting its children. */
export const createWorkbenchSurface = (sourceDocument: Document) => {
  const element = sourceDocument.createElement('div');
  element.dataset.workbenchSurface = '';
  let anchor: HTMLElement | undefined;
  let popup: Window | undefined;
  let releaseWindow: (() => void) | undefined;
  let disposed = false;
  let snapshot = inlineSnapshot;
  const listeners = new Set<() => void>();
  const publish = (next: typeof snapshot) => {
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const source = sourceDocument.defaultView;
  const dock = () => {
    const previous = popup;
    popup = undefined;
    releaseWindow?.();
    releaseWindow = undefined;
    element.removeAttribute('style');
    anchor?.append(element);
    if (previous) anchor?.focus({ preventScroll: true });
    publish(inlineSnapshot);
    if (previous && !previous.closed) previous.close();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    dock();
    source?.removeEventListener('pagehide', dock);
    element.remove();
    listeners.clear();
  };
  source?.addEventListener('pagehide', dock);

  return {
    element,
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    attach: (target: HTMLElement) => {
      anchor = target;
      if (!popup && !disposed) target.append(element);
    },
    popOut: (options?: DevToolsPopoutOptions | false) => {
      if (disposed || options === false || !source) return false;
      if (popup) {
        if (!popup.closed) {
          popup.focus();
          return true;
        }
        dock();
      }
      let opened: Window | null = null;
      try {
        opened = options?.openWindow
          ? options.openWindow(source)
          : source.open('about:blank', '_blank', 'popup,width=1100,height=800');
        if (!opened) {
          publish({
            detached: false,
            error: 'The popout was blocked. Allow popups for this application and try again.',
          });
          return false;
        }
        if (opened === source || opened.document === sourceDocument)
          throw new Error('The popout must be a separate same-origin window');
        const target = opened.document;
        target.title = 'Developer workbench';
        const base = target.createElement('base');
        base.href = sourceDocument.baseURI;
        target.head.append(base);
        const mirror = mirrorStyles(sourceDocument, target);
        target.body.style.cssText =
          'margin:0;padding:16px;display:block;min-height:100vh;box-sizing:border-box;background:#101214';
        target.body.className = sourceDocument.body.className;
        // An owned scrolling surface also works when host styles constrain html/body overflow.
        element.style.cssText =
          'position:fixed;inset:0;overflow:auto;box-sizing:border-box;padding:16px;background:#101214';
        target.body.append(element);
        popup = opened;
        const closed = () => dock();
        opened.addEventListener('pagehide', closed);
        const timer = source.setInterval(() => {
          if (popup?.closed) dock();
        }, 500);
        releaseWindow = () => {
          source.clearInterval(timer);
          opened?.removeEventListener('pagehide', closed);
          mirror();
          base.remove();
        };
        publish({ detached: true, error: '' });
        opened.focus();
        return true;
      } catch {
        if (opened && opened !== source && !opened.closed) opened.close();
        element.removeAttribute('style');
        anchor?.append(element);
        popup = undefined;
        releaseWindow?.();
        releaseWindow = undefined;
        publish({
          detached: false,
          error: 'Could not open the workbench. The host must provide a blank same-origin window.',
        });
        return false;
      }
    },
    focus: () => {
      popup?.focus();
    },
    dock,
    dispose,
  };
};

// Copy styles, never scripts or application DOM. Relative asset URLs retain the source base URI.
const mirrorStyles = (source: Document, target: Document) => {
  let copies: Element[] = [];
  const copy = () => {
    copies.forEach(node => node.remove());
    copies = [];
    for (const node of source.querySelectorAll('style, link[rel~="stylesheet"]')) {
      const clone = node.cloneNode(true) as HTMLElement;
      if (node.tagName === 'LINK') clone.setAttribute('href', (node as HTMLLinkElement).href);
      if ((node as HTMLElement).nonce) clone.nonce = (node as HTMLElement).nonce;
      target.head.append(clone);
      copies.push(clone);
    }
    // Constructed sheets cannot be adopted across documents; recreate their rules instead.
    for (const sheet of source.adoptedStyleSheets ?? []) {
      const style = target.createElement('style');
      style.textContent = Array.from(sheet.cssRules, rule => rule.cssText).join('\n');
      target.head.append(style);
      copies.push(style);
    }
  };
  copy();
  const Observer = source.defaultView?.MutationObserver;
  const observer = Observer ? new Observer(copy) : undefined;
  observer?.observe(source.head, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
  return () => {
    observer?.disconnect();
    copies.forEach(node => node.remove());
  };
};

export type WorkbenchSurface = ReturnType<typeof createWorkbenchSurface>;
export const WorkbenchSurfaceContext = createContext<WorkbenchSurface | undefined>(undefined);
export const getInlineSnapshot = () => inlineSnapshot;
export const subscribeInline = () => () => {};
