import { useCallback, type ReactNode, type RefCallback } from 'react';

/** Reserve mobile space for either mode's footer, and fit beneath the host header. */
export const GalleryFooter = ({ children }: { children: ReactNode }) => {
  const measureInput: RefCallback<HTMLElement> = useCallback(node => {
    const gallery = node?.closest('.katakit-gallery');
    if (!node || !(gallery instanceof HTMLElement)) return;
    const measure = () => {
      gallery.style.setProperty(
        '--gallery-input-height',
        `${node.getBoundingClientRect().height}px`
      );
      gallery.style.setProperty(
        '--gallery-sidebar-height',
        `${window.innerHeight - Math.max(0, gallery.getBoundingClientRect().top)}px`
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', measure);
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
