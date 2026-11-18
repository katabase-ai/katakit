import { createContext, useContext, type ReactNode } from 'react';

const Header = createContext(false);

/** Adapters suppress the standalone introduction when the gallery supplies its real header. */
export const useGalleryDemoHeader = () => useContext(Header);

/** Render known page information immediately, independently of lazy code and runtime readiness. */
export const GalleryDemoHeader = ({
  demo,
  badge,
  children,
}: {
  demo: { title: string; description?: string };
  badge?: ReactNode;
  children: ReactNode;
}) => (
  <Header value={true}>
    <header className="gallery-demo-header">
      <h1>{demo.title}</h1>
      {demo.description && <p>{demo.description}</p>}
      {badge && <div className="gallery-demo-header-badge">{badge}</div>}
    </header>
    {children}
  </Header>
);
