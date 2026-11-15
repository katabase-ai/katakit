import { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { demos, type Demo } from './demos';
import './style.css';
import '../../transcription-react/src/style.css';

const pathname = window.location.pathname.replace(/\/$/, '') || '/';
const active = demos.find(demo => demo.path === pathname);
document.title = active ? `${active.title} · Katakit demos` : 'Demos · Katakit';

const DemoPage = ({ demo }: { demo: Demo }) => {
  if (demo.kind === 'landing') {
    const Content = demo.content;
    return <Content />;
  }
  const Component = demo.component;
  return (
    <Suspense
      fallback={
        <p className="loading" role="status">
          Loading demo…
        </p>
      }
    >
      <Component />
    </Suspense>
  );
};

const App = () => (
  <div className="gallery">
    <header className="gallery-header">
      <a className="gallery-brand" href="/">
        Katakit <span>Demos</span>
      </a>
    </header>
    <div className="gallery-layout">
      <nav className="gallery-nav" aria-label="Demos">
        <a href="/" aria-current={pathname === '/' ? 'page' : undefined}>
          All demos
        </a>
        {demos.map(demo => (
          <a
            key={demo.path}
            href={demo.path}
            aria-current={pathname === demo.path ? 'page' : undefined}
          >
            {demo.title}
          </a>
        ))}
      </nav>
      <main className="gallery-content">
        {active ? (
          <DemoPage demo={active} />
        ) : pathname === '/' ? (
          <>
            <h1>Demos</h1>
            <p className="gallery-intro">Explore Katakit in action.</p>
            <ul className="demo-list">
              {demos.map(demo => (
                <li key={demo.path}>
                  <a href={demo.path}>{demo.title}</a>
                  <p>{demo.description}</p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h1>Demo not found</h1>
            <p>
              <a href="/">See all demos</a>
            </p>
          </>
        )}
      </main>
    </div>
  </div>
);

createRoot(document.getElementById('root')!).render(<App />);
