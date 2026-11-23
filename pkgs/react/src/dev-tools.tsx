import { Button } from '@base-ui/react/button';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCapture } from './dev-tools/capture';
import stylesheet from 'virtual:katakit-stylesheet';
import fontUrl from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2';
import { ToolButton } from './dev-tools/ui';
import { Timeline } from './dev-tools/timeline';
import { Inspector } from './dev-tools/inspector';
import { ResizablePanel } from './dev-tools/resizable-panel';
import type { Delivery } from './dev-tools/deliveries';

/** Render the observable timeline alongside the application in development. */
export const KatakitDevTools = () => {
  const events = useCapture();
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  useEffect(() => {
    if (!root) return;
    const fonts = root.ownerDocument.fonts;
    const face = new FontFace('Katakit JetBrains Mono', `url(${fontUrl})`, {
      weight: '100 800',
      display: 'swap',
    });
    fonts.add(face);
    return () => {
      fonts.delete(face);
    };
  }, [root]);
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
            <link rel="stylesheet" href={stylesheet} />
            <aside
              className="fixed z-[2147483646] bottom-3 right-3 left-3 sm:(left-auto bottom-5 right-5) font-mono text-[13px] leading-normal text-zinc-100 antialiased"
              aria-label="Katakit devtools"
            >
              {!open ? (
                <Button
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium text-xs cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-300 disabled:opacity-40 disabled:cursor-default ml-auto flex h-10 border border-zinc-700 bg-zinc-950 px-3 shadow-lg hover:bg-zinc-800"
                  onClick={() => setOpen(true)}
                >
                  <span className="inline-block size-4 shrink-0 i-lucide-audio-lines" /> Katakit
                  devtools
                </Button>
              ) : (
                <ResizablePanel size={size} onResize={setSize}>
                  <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-teal-300/30 bg-teal-400/10 text-teal-300">
                        <span className="inline-block size-4 shrink-0 i-lucide-audio-lines" />
                      </span>
                      <div>
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                          Katakit / Devtools
                        </p>
                        <h2 className="text-lg font-semibold tracking-tight text-zinc-50">
                          Observable timeline
                        </h2>
                      </div>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="rounded-full border border-teal-400/25 bg-teal-400/10 px-2 py-0.5 font-mono text-[10px] text-teal-300">
                        Recording
                      </span>
                      <ToolButton label="Collapse devtools" onClick={() => setOpen(false)}>
                        <span className="inline-block size-4 shrink-0 i-lucide-chevron-down" />
                      </ToolButton>
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
