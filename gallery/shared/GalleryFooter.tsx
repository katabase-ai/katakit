import { useCallback, type ReactNode, type RefCallback } from 'react';

/** Reserve mobile footer space and size the desktop sidebar without constraining demo content. */
export const GalleryFooter = ({ children }: { children: ReactNode }) => {
  const measureInput: RefCallback<HTMLElement> = useCallback(node => {
    const gallery = node?.closest('.katakit-gallery');
    if (!node || !(gallery instanceof HTMLElement)) return;
    const measure = () => {
      gallery.style.setProperty(
        '--gallery-input-height',
        `${node.getBoundingClientRect().height}px`
      );
      // Use the document offset so resizing the footer while scrolling cannot grow the sidebar.
      gallery.style.setProperty(
        '--gallery-sidebar-height',
        `${Math.max(0, window.innerHeight - gallery.getBoundingClientRect().top - window.scrollY)}px`
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      gallery.style.removeProperty('--gallery-input-height');
      gallery.style.removeProperty('--gallery-sidebar-height');
    };
  }, []);
  return (
    <div ref={measureInput} className="gallery-speech-controls">
      {children}
    </div>
  );
};
