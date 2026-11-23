import { Button } from '@base-ui/react/button';
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCapture } from './dev-tools/capture';
import { stylesheet, ui } from './dev-tools/theme.generated';
import { ToolButton } from './dev-tools/ui';
import { Timeline } from './dev-tools/timeline';
import { Inspector } from './dev-tools/inspector';
import type { Delivery } from './dev-tools/deliveries';

/** Render the observable timeline alongside the application in development. */
export const KatakitDevTools = () => {
  const events = useCapture();
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  const host = useCallback((node: HTMLDivElement | null) => {
    if (node) setRoot(node.shadowRoot ?? node.attachShadow({ mode: 'open' }));
  }, []);
  const [open, setOpen] = useState(false);
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
            <aside className={ui.shell} aria-label="Katakit devtools">
              {!open ? (
                <Button className={ui.launch} onClick={() => setOpen(true)}>
                  <span className={ui.activity} /> Katakit devtools
                </Button>
              ) : (
                <section className={ui.panel}>
                  <header className={ui.header}>
                    <div className={ui.row}>
                      <span className={ui.brand}>
                        <span className={ui.activity} />
                      </span>
                      <div>
                        <p className={ui.caption}>Katakit / Devtools</p>
                        <h2 className={ui.title}>Observable timeline</h2>
                      </div>
                    </div>
                    <div className={ui.row}>
                      <span className={ui.tag}>Recording</span>
                      <ToolButton label="Collapse devtools" onClick={() => setOpen(false)}>
                        <span className={ui.collapse} />
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
                  <footer className={ui.footer}>
                    <span>EVENT STREAM</span>
                    <span>{events.length} retained deliveries</span>
                  </footer>
                </section>
              )}
            </aside>
          </>,
          root
        )}
    </div>
  );
};
