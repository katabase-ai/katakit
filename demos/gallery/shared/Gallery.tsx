import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { galleryDemoDetails } from './galleryDemoDetails';
import { GalleryModelContext, type GalleryModelConnect } from './galleryModel';

/**
 * Portable gallery presentation. Hosts own links, route metadata, and demo mounting;
 * importing this component cannot register another application's router or start a runtime.
 * A host that passes `connectModel` gives every `remoteModel` demo its model connection.
 */
export const Gallery = ({
  demos,
  activeDemo,
  renderLink,
  children,
  input,
  connectModel,
}: {
  demos: readonly (typeof galleryDemoDetails)[number][];
  activeDemo?: (typeof galleryDemoDetails)[number];
  renderLink: (link: {
    demo?: (typeof galleryDemoDetails)[number];
    children: ReactNode;
    current: boolean;
  }) => ReactNode;
  children?: ReactNode;
  input?: ReactNode;
  connectModel?: GalleryModelConnect;
}) => {
  const [controls, setControls] = useState<HTMLElement>();
  const attachControls = useCallback((node: HTMLElement | null) => {
    setControls(node ?? undefined);
  }, []);
  const model = useMemo(
    () => ({ connect: connectModel, controls, setControls: attachControls }),
    [connectModel, controls, attachControls]
  );
  return (
    <GalleryModelContext value={model}>
      <div className="katakit-gallery">
        <aside className="gallery-sidebar">
          <nav className="gallery-nav" aria-label="React demos">
            {renderLink({ children: 'All demos', current: !activeDemo })}
            {demos.map(demo => (
              <span key={demo.id}>
                {renderLink({ demo, children: demo.title, current: activeDemo?.id === demo.id })}
              </span>
            ))}
          </nav>
          {input}
        </aside>
        <div className="gallery-content">
          {activeDemo ? (
            children
          ) : (
            <>
              <h1>React demos</h1>
              <p className="gallery-intro">Explore Katakit in your browser.</p>
              <ul className="gallery-demo-list">
                {demos.map(demo => (
                  <li key={demo.id}>
                    {renderLink({ demo, children: demo.title, current: false })}
                    <p>{demo.description}</p>
                  </li>
                ))}
              </ul>
              {children}
            </>
          )}
        </div>
      </div>
    </GalleryModelContext>
  );
};
