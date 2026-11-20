import { useCallback } from 'react';
import { ClientOnly, Link, Navigate, useNavigate } from '@tanstack/react-router';
import { Gallery } from '../shared/Gallery';
import { GallerySpeechControls } from '../shared/GallerySpeechControls';
import { galleryDemos } from '../shared/galleryDemos';
import { useGalleryMode } from '../shared/GalleryModeProvider';
import type { GalleryDeveloperPage, GalleryOperation } from '../shared/operationDetails';

/** Browser demos are mounted only after hydration, never by the SSR Worker. */
export const GalleryPage = ({
  demo,
  developerPage,
  settingsPage,
}: {
  demo?: (typeof galleryDemos)[number];
  developerPage?: GalleryDeveloperPage;
  settingsPage?: boolean;
}) => {
  const { isDeveloperView } = useGalleryMode();
  const navigate = useNavigate();
  const configure = useCallback(
    (operation?: GalleryOperation) => {
      void navigate({ to: '/operations/setup', hash: operation });
    },
    [navigate]
  );
  const Component = demo?.component;
  if (developerPage && !isDeveloperView) return <Navigate to="/" replace />;
  return (
    <Gallery
      demos={galleryDemos}
      developerPage={developerPage}
      settingsPage={settingsPage}
      onConfigureOperation={configure}
      onOpenSettings={() => {
        void navigate({ to: isDeveloperView ? '/operations/setup' : '/settings' });
      }}
      renderDeveloperLink={({ page, children, current }) => (
        <Link
          to={page === 'setup' ? '/operations/setup' : '/operations/grid'}
          aria-current={current ? 'page' : undefined}
        >
          {children}
        </Link>
      )}
      privacyUrl="https://katabase.com/privacy"
      account={{ waitlistUrl: 'https://katabase.com/waitlist' }}
      activeDemo={demo}
      input={<GallerySpeechControls />}
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
        <ClientOnly fallback={null}>
          <Component />
        </ClientOnly>
      )}
    </Gallery>
  );
};
