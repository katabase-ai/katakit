import { lazy, Suspense, useMemo, type ReactNode } from 'react';
import type { galleryDemoDetails } from './galleryDemoDetails';
import { GalleryModelContext, type GalleryModelConnect } from './galleryModel';
import { useGalleryInference } from './GalleryInferenceProvider';
import { connectWithKey } from './galleryInference';
import { GalleryFooter } from './GalleryFooter';
import { useGalleryMode } from './GalleryModeProvider';
import type { GalleryDeveloperPage, GalleryOperation } from './operationDetails';

const OperationSetup = lazy(async () => ({
  default: (await import('./GalleryOperations')).GalleryOperationSetup,
}));
const OperationGrid = lazy(async () => ({
  default: (await import('./GalleryOperations')).GalleryOperationGrid,
}));

const Welcome = lazy(async () => ({ default: (await import('./GalleryWelcome')).GalleryWelcome }));

/**
 * Portable gallery presentation. Hosts own links, route metadata, and demo mounting;
 * importing this component cannot register another application's router or start a runtime.
 * A host that passes `connectModel` gives every `remoteModel` demo its model connection.
 */
export const Gallery = ({
  demos,
  activeDemo,
  renderLink,
  children,
  input,
  connectModel,
  privacyUrl,
  developerPage,
  renderDeveloperLink,
  onConfigureOperation,
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
  connectModel?: GalleryModelConnect;
  /** Absolute host privacy URL, opened separately to preserve this conversation. */
  privacyUrl?: string;
  developerPage?: GalleryDeveloperPage;
  renderDeveloperLink?: (link: {
    page: GalleryDeveloperPage;
    children: ReactNode;
    current: boolean;
  }) => ReactNode;
  onConfigureOperation?: (operation?: GalleryOperation) => void;
}) => {
  const inference = useGalleryInference();
  const { isDeveloperView } = useGalleryMode();
  const connect = useMemo<GalleryModelConnect | undefined>(() => {
    if (!inference) return undefined;
    const sourceSignal = inference.owner.getSignal();
    if (isDeveloperView && inference.settings.source === 'key')
      return connectWithKey(inference.settings, sourceSignal);
    if (!connectModel) return undefined;
    return async input => {
      const signal = AbortSignal.any([input.signal, sourceSignal]);
      signal.throwIfAborted();
      const connection = await connectModel({ ...input, signal });
      signal.throwIfAborted();
      return {
        ...connection,
        requestCompletion: async request => {
          const combined = AbortSignal.any([signal, request.signal]);
          combined.throwIfAborted();
          const result = await connection.requestCompletion({ ...request, signal: combined });
          combined.throwIfAborted();
          return result;
        },
      };
    };
  }, [connectModel, inference, isDeveloperView]);
  const model = useMemo(
    () => ({
      connect,
      hostAvailable: !!connectModel,
      isDeveloperView,
      configure: isDeveloperView ? onConfigureOperation : undefined,
    }),
    [connect, connectModel, isDeveloperView, onConfigureOperation]
  );
  return (
    <GalleryModelContext value={model}>
      <div className="katakit-gallery">
        <aside className="gallery-sidebar">
          <nav className="gallery-nav" aria-label="React demos">
            {renderLink({ children: 'Welcome', current: !activeDemo && !developerPage })}
            {demos.map(demo => (
              <span key={demo.id}>
                {renderLink({
                  demo,
                  children: demo.title,
                  current: !developerPage && activeDemo?.id === demo.id,
                })}
              </span>
            ))}
          </nav>
          <GalleryFooter>
            {isDeveloperView ? (
              <nav className="gallery-developer-nav" aria-label="Developer tools">
                {(['setup', 'grid'] as const).map(page => (
                  <span key={page}>
                    {renderDeveloperLink?.({
                      page,
                      children: page === 'setup' ? 'Operation Setup' : 'Operation Grid',
                      current: developerPage === page,
                    })}
                  </span>
                ))}
              </nav>
            ) : (
              input
            )}
          </GalleryFooter>
        </aside>
        <div className="gallery-content">
          {isDeveloperView && developerPage ? (
            <Suspense fallback={<p role="status">Loading operations…</p>}>
              {developerPage === 'setup' ? (
                <OperationSetup />
              ) : (
                <OperationGrid demos={demos} renderLink={renderLink} />
              )}
            </Suspense>
          ) : activeDemo ? (
            children
          ) : (
            <>
              <Suspense fallback={<p role="status">Loading Welcome…</p>}>
                <Welcome privacyUrl={privacyUrl} />
              </Suspense>
              {children}
            </>
          )}
        </div>
      </div>
    </GalleryModelContext>
  );
};
