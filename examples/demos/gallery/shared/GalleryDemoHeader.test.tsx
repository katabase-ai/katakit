// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Gallery } from './Gallery';
import { GallerySpeechProvider } from './GallerySpeechProvider';
import { galleryDemos } from './galleryDemos';
import { GalleryDemoHeader } from './GalleryDemoHeader';

afterEach(cleanup);

test.each(galleryDemos)(
  '$title keeps one real header before and after its lazy view and runtime are ready',
  async demo => {
    const Component = demo.component;
    const view = render(
      <GallerySpeechProvider>
        <Gallery
          demos={galleryDemos}
          activeDemo={demo}
          renderLink={({ children }) => <a href="#demo">{children}</a>}
        >
          <Component />
        </Gallery>
      </GallerySpeechProvider>
    );
    const heading = screen.getByRole('heading', { level: 1 });
    const description = screen.getByText(demo.description);
    expect(heading.textContent).toBe(demo.title);
    expect(
      screen.getByRole('button', {
        name: demo.dataHandling.transcribedText === 'cloud' ? 'Cloud-assisted' : 'On-device',
      })
    ).toBeDefined();
    await screen.findByRole('button', {
      name: demo.id === 'color-clash' ? 'Play' : 'Start listening',
    });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toBe(heading);
    expect(screen.getByText(demo.description)).toBe(description);
    expect(document.querySelector('.gallery-demo-stage')?.getAttribute('aria-busy')).toBe('false');
    expect(screen.queryByText('Loading demo…')).toBeNull();
    view.unmount();
  }
);

const focusPage = (id: string) => (
  <>
    <button>Host action</button>
    <div className="katakit-gallery">
      <button>Gallery navigation</button>
      <GalleryDemoHeader demo={{ id, title: `Demo ${id}` }}>
        <button>Demo action</button>
      </GalleryDemoHeader>
    </div>
  </>
);

test('navigation focuses the destination title, while first mount and same-demo updates keep focus', () => {
  const view = render(focusPage('first'));
  expect(document.activeElement).not.toBe(screen.getByRole('heading'));
  const navigation = screen.getByRole('button', { name: 'Gallery navigation' });
  navigation.focus();
  view.rerender(focusPage('first'));
  expect(document.activeElement).toBe(navigation);
  view.rerender(focusPage('second'));
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Demo second' }));
  expect(screen.getByRole('heading').getAttribute('tabindex')).toBe('-1');
  const action = screen.getByRole('button', { name: 'Demo action' });
  action.focus();
  view.rerender(focusPage('second'));
  expect(document.activeElement).toBe(action);
  view.rerender(focusPage('first'));
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Demo first' }));
});

test('a host action outside the gallery keeps focus during a programmatic demo change', () => {
  const view = render(focusPage('first'));
  const host = screen.getByRole('button', { name: 'Host action' });
  host.focus();
  view.rerender(focusPage('second'));
  expect(document.activeElement).toBe(host);
});
