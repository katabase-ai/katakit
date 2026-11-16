import type { ReactNode } from 'react';
import type { galleryDemoDetails } from './galleryDemoDetails';

/**
 * Portable gallery presentation. Hosts own links, route metadata, and demo mounting;
 * importing this component cannot register another application's router or start a runtime.
 */
export const Gallery = ({
  demos,
  activeDemo,
  renderLink,
  children,
  input,
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
}) => (
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
);
