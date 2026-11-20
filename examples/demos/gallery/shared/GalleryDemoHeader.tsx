import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const Header = createContext(false);
/** Where the active demo's Start/Pause button is shown, below its description. */
const Capture = createContext<HTMLElement | undefined>(undefined);

/** Adapters suppress the standalone introduction when the gallery supplies its real header. */
export const useGalleryDemoHeader = () => useContext(Header);

/**
 * Shows the active demo's Start/Pause button below its description. Without a gallery header it
 * renders where the demo placed it.
 */
export const GalleryDemoCapture = ({ children }: { children: ReactNode }) => {
  const hasHeader = useContext(Header);
  const target = useContext(Capture);
  if (target) return createPortal(children, target);
  // The slot mounts one render after the header; rendering in place meanwhile would flash.
  return hasHeader ? null : children;
};

/** Render known page information immediately, independently of lazy code and runtime readiness. */
export const GalleryDemoHeader = ({
  demo,
  badge,
  children,
}: {
  demo: { title: string; description?: string };
  /** Information about the demo itself, above and to the right of its title. */
  badge?: ReactNode;
  children: ReactNode;
}) => {
  const [capture, setCapture] = useState<HTMLElement>();
  return (
    <Header value={true}>
      <Capture value={capture}>
        <header className="gallery-demo-header">
          <h1>{demo.title}</h1>
          {demo.description && <p>{demo.description}</p>}
          {badge && <div className="gallery-demo-header-badge">{badge}</div>}
          <div
            ref={node => setCapture(node ?? undefined)}
            className="gallery-demo-header-controls"
            role="group"
            aria-label="Demo controls"
          />
        </header>
        {children}
      </Capture>
    </Header>
  );
};
