import { useCallback } from 'react';
import { ClientOnly, Link, Navigate, useNavigate } from '@tanstack/react-router';
import { Gallery } from '../shared/Gallery';
import { GallerySpeechControls } from '../shared/GallerySpeechControls';
import { galleryDemos } from '../shared/galleryDemos';
import type { GalleryDemoSection } from '../shared/galleryDemoDetails';
import { useGalleryMode } from '../shared/GalleryModeProvider';
import type { GalleryDeveloperPage, GalleryOperation } from '../shared/operationDetails';
import { useLocalInference } from './localInference';
import { usePreviewInference } from './previewInference';

/** Browser demos are mounted only after hydration, never by the SSR Worker. */
export const GalleryPage = ({
  demo,
  section,
  developerPage,
  settingsPage,
}: {
  demo?: (typeof galleryDemos)[number];
  section?: GalleryDemoSection;
  developerPage?: GalleryDeveloperPage;
  settingsPage?: boolean;
}) => {
  const { isDeveloperView } = useGalleryMode();
  const localConnect = useLocalInference(isDeveloperView);
  const previewConnect = usePreviewInference();
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
      activeSection={section}
      renderSectionLink={({ section, children, current }) => (
        <Link
          to="/sections/$sectionId"
          params={{ sectionId: section.toLowerCase() }}
          aria-current={current ? 'page' : undefined}
        >
          {children}
        </Link>
      )}
      sourceRevision={import.meta.env.VITE_GALLERY_SOURCE_REVISION}
      connectModel={previewConnect ?? localConnect}
      modelConnectionLabel={localConnect ? 'Server environment' : undefined}
      cloudPrivacyDescription={
        previewConnect
          ? 'Cloud processing sends transcript text and demo context through Katabase’s demo service to OpenRouter and its model provider. Audio stays on this device.'
          : undefined
      }
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
      termsUrl="https://katabase.com/Terms"
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
