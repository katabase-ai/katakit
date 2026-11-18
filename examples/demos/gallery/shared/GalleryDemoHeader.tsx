import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from 'react';

const Header = createContext(false);

/** Adapters suppress the standalone introduction when the gallery supplies its real header. */
export const useGalleryDemoHeader = () => useContext(Header);

/** Render known page information immediately, independently of lazy code and runtime readiness. */
export const GalleryDemoHeader = ({
  demo,
  badge,
  children,
}: {
  demo: { id?: string; title: string; description?: string };
  badge?: ReactNode;
  children: ReactNode;
}) => {
  const heading = useRef<HTMLHeadingElement>(null);
  const id = demo.id ?? demo.title;
  const previous = useRef(id);
  useLayoutEffect(() => {
    if (previous.current === id) return;
    previous.current = id;
    const active = document.activeElement;
    const gallery = heading.current?.closest('.katakit-gallery');
    // Do not take initial focus or steal it from a host control outside the gallery.
    if (active === document.body || (active && gallery?.contains(active))) {
      heading.current?.focus();
    }
  }, [id]);
  return (
    <Header value={true}>
      <header className="gallery-demo-header">
        <h1 ref={heading} tabIndex={-1}>
          {demo.title}
        </h1>
        {demo.description && <p>{demo.description}</p>}
        {badge && <div className="gallery-demo-header-badge">{badge}</div>}
      </header>
      {children}
    </Header>
  );
};
