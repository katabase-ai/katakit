// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Gallery } from './Gallery';
import { GalleryDemoFrame } from './GalleryDemoFrame';
import { GallerySpeechProvider } from './GallerySpeechProvider';
import { galleryDemos } from './galleryDemos';

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
          <GalleryDemoFrame demo={demo}>
            <Component />
          </GalleryDemoFrame>
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
