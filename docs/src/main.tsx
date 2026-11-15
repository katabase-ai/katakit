import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
  redirect,
  useLocation,
} from '@tanstack/react-router';
import Markdown from 'react-markdown';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import nav from './nav.json';
import './style.css';

type NavItem = { label: string; slug?: string; children?: NavItem[] };
const tree: NavItem[] = nav;
const sources = import.meta.glob('../pages/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const pages = Object.fromEntries(
  Object.entries(sources).map(([path, text]) => [
    path
      .replace('../pages/', '')
      .replace(/\/README\.md$/, '')
      .replace(/\.md$/, ''),
    text,
  ])
);
const landingPages = new Set(
  Object.keys(sources)
    .filter(path => path.endsWith('/README.md'))
    .map(path => path.replace('../pages/', '').replace(/\/README\.md$/, ''))
);

const firstPage = (items: NavItem[]): string => {
  for (const item of items) {
    if (item.slug) return item.slug;
    const first = firstPage(item.children ?? []);
    if (first) return first;
  }
  return '';
};

const NavLabel = ({ item }: { item: NavItem }) =>
  item.slug ? (
    <Link
      to="/$"
      params={{ _splat: item.slug }}
      activeOptions={{ exact: true }}
      activeProps={{ 'aria-current': 'page' }}
    >
      {item.label}
    </Link>
  ) : (
    <span className="nav-group">{item.label}</span>
  );

const NavBranch = ({ item, idPrefix }: { item: NavItem; idPrefix: string }) => {
  const pathname = useLocation({ select: location => location.pathname });
  const inSection = Boolean(
    item.slug && (pathname === `/${item.slug}` || pathname.startsWith(`/${item.slug}/`))
  );
  const [expanded, setExpanded] = useState(inSection);
  useEffect(() => {
    if (inSection) setExpanded(true);
  }, [inSection]);
  const childrenId = `${idPrefix}-${(item.slug ?? item.label).replace(/[^a-z\d-]/gi, '-')}`;
  return (
    <>
      <div className="nav-row">
        <NavLabel item={item} />
        <button
          type="button"
          className="nav-toggle"
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`}
          aria-expanded={expanded}
          aria-controls={childrenId}
          onClick={() => setExpanded(value => !value)}
        >
          <span className="chevron" aria-hidden="true" />
        </button>
      </div>
      <div id={childrenId} hidden={!expanded}>
        <NavItems items={item.children ?? []} idPrefix={idPrefix} />
      </div>
    </>
  );
};

const NavItems = ({ items, idPrefix }: { items: NavItem[]; idPrefix: string }) => {
  return (
    <ul>
      {items.map(item => (
        <li key={item.slug ?? item.label}>
          {item.children?.length ? (
            <NavBranch item={item} idPrefix={idPrefix} />
          ) : (
            <NavLabel item={item} />
          )}
        </li>
      ))}
    </ul>
  );
};

const ThemeToggle = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const selected = document.documentElement.dataset.theme;
    return selected === 'light' || selected === 'dark'
      ? selected
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  });

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const followSystem = () => {
      if (!document.documentElement.hasAttribute('data-theme')) {
        setTheme(preference.matches ? 'dark' : 'light');
      }
    };
    preference.addEventListener('change', followSystem);
    return () => preference.removeEventListener('change', followSystem);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem('katakit-docs-theme', next);
    } catch {
      /* Keep the choice for this page. */
    }
  };

  return (
    <span className="theme-control">
      <button
        type="button"
        className="theme-toggle"
        aria-label="Toggle color theme"
        aria-describedby="theme-tooltip"
        onClick={toggle}
      >
        {theme === 'dark' ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20.3 15.6A8.5 8.5 0 0 1 8.4 3.7a8.5 8.5 0 1 0 11.9 11.9Z" />
          </svg>
        )}
      </button>
      <span className="theme-tooltip" id="theme-tooltip" role="tooltip">
        Switch to {theme === 'dark' ? 'light' : 'dark'} mode
      </span>
    </span>
  );
};

const Layout = () => {
  return (
    <div className="site">
      <header className="site-header">
        <Link to="/" className="brand">
          Katakit <span>Documentation</span>
        </Link>
        <div className="header-actions">
          <ThemeToggle />
          <a href="https://github.com/katabase-ai/katakit">Source on GitHub</a>
        </div>
      </header>
      <div className="site-body">
        <nav className="site-nav" aria-label="Documentation">
          <div className="desktop-nav">
            <NavItems items={tree} idPrefix="desktop" />
          </div>
          <details className="mobile-nav">
            <summary>Browse documentation</summary>
            <NavItems items={tree} idPrefix="mobile" />
          </details>
        </nav>
        <main id="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

// Convert Markdown's relative .md targets into URLs independent of the renderer.
const pageHref = (href: string, slug: string) => {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href) || href.startsWith('/')) return href;
  const sourcePath = landingPages.has(slug) ? `${slug}/README.md` : `${slug}.md`;
  const url = new URL(href, `https://docs.local/${sourcePath}`);
  const pathname = url.pathname
    .replace(/\/README\.md$/, '')
    .replace(/\.md$/, '')
    .replace(/\/$/, '');
  return `${pathname}${url.search}${url.hash}`;
};

const Page = () => {
  const { _splat: slug = '' } = pageRoute.useParams();
  const source = pages[slug];
  if (!source)
    return (
      <article className="prose">
        <h1>Page not found</h1>
        <p>Choose a page from the navigation.</p>
      </article>
    );
  return (
    <article className="prose">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          a: ({ href = '', ...props }) => <a {...props} href={pageHref(href, slug)} />,
          input: props => <input {...props} aria-hidden="true" tabIndex={-1} />,
        }}
      >
        {source}
      </Markdown>
    </article>
  );
};

const rootRoute = createRootRoute({ component: Layout });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/$', params: { _splat: firstPage(tree) } });
  },
});
const pageRoute = createRoute({ getParentRoute: () => rootRoute, path: '$', component: Page });
const routeTree = rootRoute.addChildren([indexRoute, pageRoute]);
const router = createRouter({ routeTree });
declare module '@tanstack/react-router' {
  // TanStack Router merges this interface to register route types globally.
  // oxlint-disable-next-line typescript/consistent-type-definitions
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
