import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from 'react';

const Header = createContext(false);
const NavigationFocus = createContext<{ current?: { id: string; focused: boolean } } | null>(null);

/** Keep focus ownership across route components that remount the gallery header. */
export const GalleryNavigationFocusProvider = ({ children }: { children: ReactNode }) => {
  const navigation = useRef<{ current?: { id: string; focused: boolean } }>({});
  return <NavigationFocus value={navigation.current}>{children}</NavigationFocus>;
};

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
  const navigation = useContext(NavigationFocus);
  useLayoutEffect(() => {
    const last = navigation?.current;
    const changed = last ? last.id !== id && last.focused : previous.current !== id;
    previous.current = id;
    const active = document.activeElement;
    const gallery = heading.current?.closest('.katakit-gallery');
    // Do not take initial focus or steal it from a host control outside the gallery.
    if (changed && (active === document.body || (active && gallery?.contains(active)))) {
      heading.current?.focus();
    }
    if (navigation) navigation.current = { id, focused: false };
    return () => {
      if (navigation)
        navigation.current = {
          id,
          focused: !!gallery?.contains(document.activeElement),
        };
    };
  }, [id, navigation]);
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
