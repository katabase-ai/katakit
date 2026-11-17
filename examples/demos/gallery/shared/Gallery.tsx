import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import type { galleryDemoDetails } from './galleryDemoDetails';
import { GalleryModelContext, type GalleryModelConnect } from './galleryModel';
import { useGalleryInference } from './GalleryInferenceProvider';
import { connectWithKey } from './galleryInference';

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
}) => {
  const inference = useGalleryInference();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const connect = useMemo<GalleryModelConnect | undefined>(() => {
    if (!inference) return undefined;
    const sourceSignal = inference.owner.getSignal();
    if (inference.settings.source === 'key')
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
  }, [connectModel, inference]);
  const model = useMemo(
    () => ({ connect, hostAvailable: !!connectModel, settingsOpen, setSettingsOpen }),
    [connect, connectModel, settingsOpen]
  );
  return (
    <GalleryModelContext value={model}>
      <div className="katakit-gallery">
        <aside className="gallery-sidebar">
          <nav className="gallery-nav" aria-label="React demos">
            {renderLink({ children: 'Welcome', current: !activeDemo })}
            {demos.map(demo => (
              <span key={demo.id}>
                {renderLink({ demo, children: demo.title, current: activeDemo?.id === demo.id })}
              </span>
            ))}
          </nav>
          {input}
        </aside>
        <div className="gallery-content">
          {activeDemo ? (
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
