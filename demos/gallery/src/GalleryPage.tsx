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
          <Link
            to="/demos/$demoId"
            params={{ demoId: entry.id }}

            aria-current={current ? 'page' : undefined}
          >
            {children}
          </Link>
        ) : (
          <Link to="/" aria-current={current ? 'page' : undefined}>
            {children}
          </Link>
        )
      }
    >
      {Component && (
        <ClientOnly
          fallback={
            <div>
              <h1>{demo?.title}</h1>
              <p role="status">Loading demo…</p>
            </div>
          }
        >
          <Suspense
            fallback={
              <div>
                <h1>{demo?.title}</h1>
                <p role="status">Loading demo…</p>
              </div>
            }
          >
            <Component />
          </Suspense>
        </ClientOnly>
      )}
    </Gallery>
  );
};
