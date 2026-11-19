import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const Header = createContext(false);
/** The two places beside the title: a demo's own controls, then its pause/resume button. */
const Slots = createContext<{ controls?: HTMLElement; capture?: HTMLElement }>({});

/** Adapters suppress the standalone introduction when the gallery supplies its real header. */
export const useGalleryDemoHeader = () => useContext(Header);

/**
 * Shows a demo's controls beside its title: its own controls first, then (`slot="capture"`) the
 * pause/resume button. A demo's own controls stay hidden until it has started. Without a gallery
 * header the controls render where the demo placed them.
 */
export const GalleryDemoControls = ({
  slot = 'controls',
  children,
}: {
  slot?: 'capture' | 'controls';
  children: ReactNode;
}) => {
  const hasHeader = useContext(Header);
  const target = useContext(Slots)[slot];
  if (target) return createPortal(children, target);
  // The slots mount one render after the header; rendering in place meanwhile would flash.
  return hasHeader ? null : children;
};

/** Render known page information immediately, independently of lazy code and runtime readiness. */
export const GalleryDemoHeader = ({
  demo,
  badge,
  children,
}: {
  demo: { title: string; description?: string };
  /** Information about the demo itself above its title: Run locally and data handling. */
  badge?: ReactNode;
  children: ReactNode;
}) => {
  const [controls, setControls] = useState<HTMLElement>();
  const [capture, setCapture] = useState<HTMLElement>();
  return (
    <Header value={true}>
      <Slots value={{ controls, capture }}>
        <header className="gallery-demo-header">
          {badge && <div className="gallery-demo-header-badge">{badge}</div>}
          <h1>{demo.title}</h1>
          {demo.description && <p>{demo.description}</p>}
          <div className="gallery-demo-header-controls" role="group" aria-label="Demo controls">
            <div ref={node => setControls(node ?? undefined)} />
            <div ref={node => setCapture(node ?? undefined)} />
          </div>
        </header>
        {children}
      </Slots>
    </Header>
  );
};
