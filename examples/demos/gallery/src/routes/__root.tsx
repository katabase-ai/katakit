import { createRootRoute, HeadContent, Scripts, Outlet, Link } from '@tanstack/react-router';
import '../style.css';
import { ThemeToggle } from '../ThemeToggle';
import { GallerySpeechProvider } from '../../shared/GallerySpeechProvider';

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
        <div className="gallery-host">
          <header className="gallery-header">
            <Link to="/">Katakit · Demos</Link>
            <ThemeToggle />
          </header>
          <main>
            <GallerySpeechProvider>
              <Outlet />
            </GallerySpeechProvider>
          </main>
        </div>
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
