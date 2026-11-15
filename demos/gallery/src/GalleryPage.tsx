import { Suspense } from 'react';
import { ClientOnly, Link } from '@tanstack/react-router';
import { Gallery } from '../shared/Gallery';
import { galleryDemos } from '../shared/galleryDemos';

/** Browser demos are mounted only after hydration, never by the SSR Worker. */
export const GalleryPage = ({ demo }: { demo?: (typeof galleryDemos)[number] }) => {
  const Component = demo?.component;
  return (
    <Gallery
      demos={galleryDemos}
      activeDemo={demo}
      renderLink={({ demo: entry, children, current }) =>
        entry ? (
          // Legacy demos have module-owned runtimes and separate capture owners. Preserve the
          // old document teardown until the shared utility and runtime lifecycle are integrated.
          <Link
            to="/demos/$demoId"
            params={{ demoId: entry.id }}
            reloadDocument
            aria-current={current ? 'page' : undefined}
          >
            {children}
          </Link>
        ) : (
          <Link to="/" reloadDocument aria-current={current ? 'page' : undefined}>
            {children}
          </Link>
        )
      }
    >
      {Component && (
        <ClientOnly fallback={<p role="status">Loading demo…</p>}>
          <Suspense fallback={<p role="status">Loading demo…</p>}>
            <Component />
          </Suspense>
        </ClientOnly>
      )}
    </Gallery>
  );
};
