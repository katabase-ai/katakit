// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Gallery } from './Gallery';
import { GallerySpeechProvider } from './GallerySpeechProvider';
import { galleryWelcomeDetails } from './galleryWelcomeDetails';

const module = vi.hoisted(() => {
  let complete!: () => void;
  const promise = new Promise<void>(resolve => {
    complete = resolve;
  });
  return { promise, resolve: complete };
});

vi.mock('./GalleryWelcome', async importOriginal => {
  await module.promise;
  return importOriginal<typeof import('./GalleryWelcome')>();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test('Welcome keeps its real header through a delayed import and reveals without waiting for microphone setup', async () => {
  vi.useFakeTimers();
  render(
    <GallerySpeechProvider>
      <Gallery demos={[]} renderLink={({ children }) => <a href="/">{children}</a>} />
    </GallerySpeechProvider>
  );
  const heading = screen.getByRole('heading', { level: 1, name: 'Welcome!' });
  const description = screen.getByText(galleryWelcomeDetails.description);
  const frame = document.querySelector('.gallery-demo-frame')!;
  expect(frame.getAttribute('data-loading')).toBe('true');
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByText('Loading Welcome…')).toBeNull();
  act(() => vi.advanceTimersByTime(249));
  expect(screen.queryByRole('status')).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole('status').textContent).toBe('Opening…');
  await act(async () => {
    module.resolve();
    await import('./GalleryWelcome');
  });
  expect(screen.getByRole('heading', { level: 1 })).toBe(heading);
  expect(screen.getByText(galleryWelcomeDetails.description)).toBe(description);
  expect(frame.getAttribute('data-loading')).toBe('false');
  expect(screen.queryByText('Opening…')).toBeNull();
  expect(screen.getByRole('button', { name: 'Set up microphone' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Microphone setup: Not set up' })).toBeDefined();
  expect(screen.queryByRole('progressbar')).toBeNull();
});
