import { Button } from '@base-ui/react/button';
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCapture } from './dev-tools/capture';
import { stylesheet, ui } from './dev-tools/theme.generated';
import { ToolButton } from './dev-tools/ui';

/** Render the observable timeline alongside the application in development. */
export const KatakitDevTools = () => {
  const events = useCapture();
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  const host = useCallback((node: HTMLDivElement | null) => {
    if (node) setRoot(node.shadowRoot ?? node.attachShadow({ mode: 'open' }));
  }, []);
  const [open, setOpen] = useState(false);
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
                        <h2 className={ui.title}>Observable timeline</h2>
                        <p className={ui.hint}>Katakit devtools</p>
                      </div>
                    </div>
                    <div className={ui.row}>
                      <span className={ui.tag}>Recording</span>
                      <ToolButton label="Collapse devtools" onClick={() => setOpen(false)}>
                        <span className={ui.collapse} />
                      </ToolButton>
                    </div>
                  </header>
                  <p className={ui.hint}>{events.length} retained deliveries</p>
                </section>
              )}
            </aside>
          </>,
          root
        )}
    </div>
  );
};
