import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCapture } from './dev-tools/capture';
import stylesheet, { fontStylesheet } from 'virtual:katakit-stylesheet';
import { ToolButton } from './dev-tools/ui';
import { Timeline } from './timeline';
import { Inspector } from './dev-tools/inspector';
import { ResizablePanel } from './dev-tools/resizable-panel';
import type { Delivery } from './dev-tools/deliveries';
import { useMemo } from 'react';

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
  const lanes = useMemo(
    () =>
      [...new Set(events.map(event => event.lane))].map(id => ({
        id,
        label: id,
      })),
    [events]
  );
  const timelineEvents = useMemo(
    () =>
      events.map(event => ({
        id: `${event.lane}:${event.messageNumber}`,
        laneId: event.lane,
        time: event.time,
      })),
    [events]
  );
  const deliveryById = (id: string) =>
    events.find(event => `${event.lane}:${event.messageNumber}` === id);
  return (
    <div ref={host} data-katakit-devtools="">
      {root &&
        createPortal(
          <>
            {createPortal(<link rel="stylesheet" href={fontStylesheet} />, root.ownerDocument.head)}
            <link rel="stylesheet" href={stylesheet} />
            <aside
              className="fixed z-[2147483646] bottom-3 right-3 left-3 sm:(left-auto bottom-5 right-5) font-sans text-[13px] leading-normal text-zinc-100 antialiased"
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
                  <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-teal-300/30 bg-teal-400/10 text-teal-300">
                        <span className="inline-block size-4 shrink-0 i-lucide-audio-lines" />
                      </span>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                          Katakit / Devtools
                        </p>
                        <h2 className="text-lg font-semibold tracking-tight text-zinc-50">
                          Observable timeline
                        </h2>
                      </div>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="rounded-full border border-teal-400/25 bg-teal-400/10 px-2 py-0.5 text-[10px] text-teal-300">
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
                    lanes={lanes}
                    events={timelineEvents}
                    playheadTime={(pinned ?? preview)?.time}
                    selectedId={pinned ? `${pinned.lane}:${pinned.messageNumber}` : undefined}
                    onPreview={id => setPreview(deliveryById(id))}
                    onSelect={id => setPinned(deliveryById(id))}
                    emptyLabel="Waiting for the first observable delivery…"
                  />
                  <Inspector
                    event={pinned ?? preview}
                    pinned={!!pinned}
                    release={() => setPinned(undefined)}
                    origin={events[0]?.time ?? 0}
                  />
                  <footer className="flex items-center justify-between gap-2 border-t border-zinc-800 px-4 py-2 font-mono text-[10px] text-zinc-400">
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
