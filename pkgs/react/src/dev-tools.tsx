import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCapture } from './dev-tools/capture';
import stylesheet, { fontStylesheet } from 'virtual:katakit-stylesheet';
import { ToolButton } from './dev-tools/ui';
import { Timeline } from './dev-tools/timeline';
import { Inspector } from './dev-tools/inspector';
import { ResizablePanel } from './dev-tools/resizable-panel';
import type { Delivery } from './dev-tools/deliveries';

/**
 * Displays deliveries from observable collections first accessed after the panel mounts.
 * Mount behind the host's development flag. Panels share capture until the last one unmounts.
 */
export const KatakitDevTools = () => {
  const events = useCapture();
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  const host = useCallback((node: HTMLDivElement | null) => {
    if (node) setRoot(node.shadowRoot ?? node.attachShadow({ mode: 'open' }));
  }, []);
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState({ width: 900, height: 530 });
  const [preview, setPreview] = useState<Delivery>();
  const [pinned, setPinned] = useState<Delivery>();
  const [hidden, setHidden] = useState(new Set<string>());
  const toggleLane = (name: string) =>
    setHidden(previous => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  return (
    <div ref={host} data-katakit-devtools="">
      {root &&
        createPortal(
          <>
            {createPortal(<link rel="stylesheet" href={fontStylesheet} />, root.ownerDocument.head)}
            <link rel="stylesheet" href={stylesheet} />
            <aside
              className=":uno: fixed z-[2147483646] bottom-3 right-3 left-3 sm:(left-auto bottom-5 right-5) font-sans text-[13px] leading-normal text-zinc-100 antialiased"
              aria-label="Katakit devtools"
            >
              {!open ? (
                <ToolButton
                  label="Katakit devtools"
                  variant="launcher"
                  icon="launcher"
                  onClick={() => setOpen(true)}
                >
                  Katakit devtools
                </ToolButton>
              ) : (
                <ResizablePanel size={size} onResize={setSize}>
                  <header className=":uno: flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                    <div className=":uno: flex min-w-0 items-center gap-2">
                      <span className=":uno: grid size-8 shrink-0 place-items-center rounded-lg border border-teal-300/30 bg-teal-400/10 text-teal-300">
                        <span className=":uno: inline-block size-4 shrink-0 i-lucide-audio-lines" />
                      </span>
                      <div>
                        <p className=":uno: text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                          Katakit / Devtools
                        </p>
                        <h2 className=":uno: text-lg font-semibold tracking-tight text-zinc-50">
                          Observable timeline
                        </h2>
                      </div>
                    </div>
                    <div className=":uno: flex min-w-0 items-center gap-2">
                      <span className=":uno: rounded-full border border-teal-400/25 bg-teal-400/10 px-2 py-0.5 text-[10px] text-teal-300">
                        Recording
                      </span>
                      <ToolButton
                        label="Collapse devtools"
                        icon="collapse"
                        onClick={() => setOpen(false)}
                      />
                    </div>
                  </header>
                  <Timeline
                    events={events}
                    selected={pinned ?? preview}
                    pinned={pinned}
                    hidden={hidden}
                    toggleLane={toggleLane}
                    onPreview={setPreview}
                    onPin={setPinned}
                  />
                  <Inspector
                    event={pinned ?? preview}
                    pinned={!!pinned}
                    release={() => setPinned(undefined)}
                    origin={events[0]?.time ?? 0}
                  />
                  <footer className=":uno: flex items-center justify-between gap-2 border-t border-zinc-800 px-4 py-2 font-mono text-[10px] text-zinc-400">
                    <span>EVENT STREAM</span>
                    <span>{events.length} retained deliveries</span>
                  </footer>
                </ResizablePanel>
              )}
            </aside>
          </>,
          root
        )}
    </div>
  );
};
