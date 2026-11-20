import { createRootRoute, HeadContent, Scripts, Outlet, Link } from '@tanstack/react-router';
import '../style.css';
import { GalleryHeader } from '../GalleryHeader';
import { GalleryModeProvider } from '../../shared/GalleryModeProvider';
import { galleryDeveloperBuild } from '../galleryEnvironment';
import { GallerySpeechProvider } from '../../shared/GallerySpeechProvider';
import { GalleryConsentProvider } from '../../shared/GalleryConsentProvider';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'React demos · Katakit' },
    ],
  }),
  component: () => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <GallerySpeechProvider>
          <GalleryModeProvider developerMode={galleryDeveloperBuild}>
            <div className="gallery-host">
              <GalleryHeader />
              <GalleryConsentProvider>
                <main>
                  <Outlet />
                </main>
              </GalleryConsentProvider>
            </div>
          </GalleryModeProvider>
        </GallerySpeechProvider>
        <Scripts />
      </body>
    </html>
  ),
  notFoundComponent: () => (
    <section className="gallery-message">
      <h1>Demo not found</h1>
      <Link to="/">See all demos</Link>
    </section>
  ),
  errorComponent: () => (
    <section className="gallery-message">
      <h1>Could not load this demo</h1>
      <p>Check your connection and try again.</p>
      <button onClick={() => window.location.reload()}>Retry loading</button>
    </section>
  ),
});
