// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { GalleryCaptureControls } from './GalleryCaptureControls';
import { GalleryTermsContext } from './GalleryTermsContext';
import { GalleryConsentProvider } from './GalleryConsentProvider';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

const Harness = ({ disabled = false, onClick = vi.fn() }) => (
  <GalleryConsentProvider>
    <GalleryTermsContext value="https://example.com/terms">
      <GalleryCaptureControls action={{ label: 'Play', disabled, onClick }} />
      <GalleryCaptureControls action={{ label: 'Start', onClick }} />
    </GalleryTermsContext>
  </GalleryConsentProvider>
);

test('a primary action describes consent and links to the host Terms in a separate tab', () => {
  const onClick = vi.fn();
  render(<Harness onClick={onClick} />);
  const play = screen.getByRole('button', { name: 'Play' });
  const notice = document.getElementById(play.getAttribute('aria-describedby')!)!;
  expect(notice.textContent).toBe('By continuing, you agree to our Terms of Service.');
  const link = notice.querySelector('a')!;
  expect(link.getAttribute('href')).toBe('https://example.com/terms');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  fireEvent.click(link);
  expect(onClick).not.toHaveBeenCalled();
  expect(screen.getAllByRole('link', { name: 'Terms of Service' })).toHaveLength(2);
  fireEvent.click(play);
  expect(onClick).toHaveBeenCalledOnce();
  expect(screen.queryByRole('link', { name: 'Terms of Service' })).toBeNull();
  expect(play.getAttribute('aria-describedby')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(onClick).toHaveBeenCalledTimes(2);
});

test('acceptance survives a route remount and reload, but a fresh tab session shows the notice', () => {
  const first = render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  first.unmount();
  const reloaded = render(<Harness />);
  expect(screen.queryByRole('link', { name: 'Terms of Service' })).toBeNull();
  reloaded.unmount();
  // A separate browser tab session starts without the previous tab's storage.
  window.sessionStorage.clear();
  render(<Harness />);
  expect(screen.getAllByRole('link', { name: 'Terms of Service' })).toHaveLength(2);
});

test('a disabled primary action does not accept the notice', () => {
  const onClick = vi.fn();
  const view = render(<Harness disabled onClick={onClick} />);
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(onClick).not.toHaveBeenCalled();
  expect(screen.getAllByRole('link', { name: 'Terms of Service' })).toHaveLength(2);
  view.unmount();
  render(<Harness />);
  expect(screen.getAllByRole('link', { name: 'Terms of Service' })).toHaveLength(2);
});

test('blocked storage still remembers acceptance across controls until the provider unmounts', () => {
  vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
    throw new Error('Storage is blocked');
  });
  const onClick = vi.fn();
  const view = render(<Harness onClick={onClick} />);
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(onClick).toHaveBeenCalledOnce();
  expect(screen.queryByRole('link', { name: 'Terms of Service' })).toBeNull();
  view.rerender(<Harness onClick={onClick} />);
  expect(screen.queryByRole('link', { name: 'Terms of Service' })).toBeNull();
  view.unmount();
  render(<Harness />);
  expect(screen.getAllByRole('link', { name: 'Terms of Service' })).toHaveLength(2);
});

test('a storage write failure does not interrupt the action or restore the notice', () => {
  const storage = window.sessionStorage;
  vi.spyOn(storage, 'setItem').mockImplementation(() => {
    throw new Error('Storage is full');
  });
  const onClick = vi.fn();
  render(<Harness onClick={onClick} />);
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(onClick).toHaveBeenCalledOnce();
  expect(screen.queryByRole('link', { name: 'Terms of Service' })).toBeNull();
});

test('secondary actions and hosts without Terms do not present a consent notice', () => {
  const view = render(
    <GalleryConsentProvider>
      <GalleryTermsContext value="/terms">
        <GalleryCaptureControls
          action={{ label: 'Cancel setup', secondary: true, onClick: vi.fn() }}
        />
      </GalleryTermsContext>
    </GalleryConsentProvider>
  );
  expect(screen.queryByRole('link', { name: 'Terms of Service' })).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Cancel setup' }).getAttribute('aria-describedby')
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel setup' }));
  view.rerender(<Harness />);
  expect(screen.getAllByRole('link', { name: 'Terms of Service' })).toHaveLength(2);
  view.rerender(<GalleryCaptureControls action={{ label: 'Play', onClick: vi.fn() }} />);
  expect(screen.queryByRole('link', { name: 'Terms of Service' })).toBeNull();
});
