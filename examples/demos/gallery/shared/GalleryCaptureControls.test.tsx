// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { GalleryCaptureControls } from './GalleryCaptureControls';
import { GalleryTermsContext } from './GalleryTermsContext';

afterEach(cleanup);

test('a primary action describes consent and links to the host Terms in a separate tab', () => {
  const onClick = vi.fn();
  render(
    <GalleryTermsContext value="https://example.com/terms">
      <GalleryCaptureControls action={{ label: 'Play', onClick }} />
    </GalleryTermsContext>
  );
  const play = screen.getByRole('button', { name: 'Play' });
  const notice = document.getElementById(play.getAttribute('aria-describedby')!)!;
  expect(notice.textContent).toBe('By continuing, you agree to our Terms of Service.');
  const link = screen.getByRole('link', { name: 'Terms of Service' });
  expect(link.getAttribute('href')).toBe('https://example.com/terms');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  fireEvent.click(link);
  expect(onClick).not.toHaveBeenCalled();
  fireEvent.click(play);
  expect(onClick).toHaveBeenCalledOnce();
});

test('secondary actions and hosts without Terms do not present a consent notice', () => {
  const view = render(
    <GalleryTermsContext value="/terms">
      <GalleryCaptureControls
        action={{ label: 'Cancel setup', secondary: true, onClick: vi.fn() }}
      />
    </GalleryTermsContext>
  );
  expect(screen.queryByRole('link', { name: 'Terms of Service' })).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Cancel setup' }).getAttribute('aria-describedby')
  ).toBeNull();
  view.rerender(<GalleryCaptureControls action={{ label: 'Play', onClick: vi.fn() }} />);
  expect(screen.queryByRole('link', { name: 'Terms of Service' })).toBeNull();
});
