// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { GalleryPublicSettings } from './GalleryPublicSettings';
import { GalleryModelContext } from './galleryModel';

afterEach(cleanup);

test('the waitlist uses the host destination without offering signup or sign-in', () => {
  render(
    <GalleryModelContext value={{ account: { waitlistUrl: 'https://example.com/waitlist' } }}>
      <GalleryPublicSettings
        privacyUrl="https://katabase.com/privacy"
        termsUrl="https://example.com/terms"
      />
    </GalleryModelContext>
  );
  expect(
    screen.getByRole('heading', { name: 'Take your ideas further with Katabase' })
  ).toBeDefined();
  expect(screen.queryByText(/access to developer tools/i)).toBeNull();
  expect(screen.getByRole('link', { name: 'Join the waitlist' }).getAttribute('href')).toBe(
    'https://example.com/waitlist'
  );
  expect(screen.queryByRole('button', { name: 'Create an account' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  expect(screen.queryByText(/Already have an account/)).toBeNull();
  expect(screen.queryByLabelText('API key')).toBeNull();
  expect(screen.queryByRole('navigation', { name: 'Operation views' })).toBeNull();
  const privacy = screen.getByRole('link', { name: 'Privacy Policy' });
  expect(privacy.getAttribute('href')).toBe('https://katabase.com/privacy');
  expect(privacy.getAttribute('rel')).toBe('noopener noreferrer');
  const terms = screen.getByRole('link', { name: 'Terms of Service' });
  expect(terms.getAttribute('href')).toBe('https://example.com/terms');
  expect(terms.getAttribute('target')).toBe('_blank');
  expect(terms.getAttribute('rel')).toBe('noopener noreferrer');
});

test('a host without a waitlist destination does not offer fake registration or sign-in', () => {
  render(<GalleryPublicSettings />);
  expect(screen.queryByRole('link', { name: 'Join the waitlist' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Create an account' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  expect(screen.queryByText(/Signed in as/)).toBeNull();
  expect(screen.queryByRole('link', { name: 'Privacy Policy' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Terms of Service' })).toBeNull();
});

test('signed-in users see account management instead of signup', () => {
  const onOpenAccount = vi.fn();
  const view = render(
    <GalleryModelContext value={{ account: { user: { name: 'Ada Lovelace' }, onOpenAccount } }}>
      <GalleryPublicSettings />
    </GalleryModelContext>
  );
  expect(screen.getByText('Ada Lovelace')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Create an account' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Manage account' }));
  expect(onOpenAccount).toHaveBeenCalledOnce();
  view.rerender(
    <GalleryModelContext value={{ account: { user: { name: 'Ada Lovelace' } } }}>
      <GalleryPublicSettings />
    </GalleryModelContext>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Manage account' }));
  expect(screen.getByRole('status').textContent).toBe(
    'Account settings aren’t available here yet.'
  );
});

test('allowance summary follows host updates and explains missing data', () => {
  const view = render(
    <GalleryModelContext value={{ allowance: { remaining: 1, total: 5 } }}>
      <GalleryPublicSettings />
    </GalleryModelContext>
  );
  expect(
    (screen.getByRole('progressbar', { name: 'Model call usage' }) as HTMLProgressElement).value
  ).toBe(80);
  view.rerender(
    <GalleryModelContext value={{ allowance: { remaining: 0, total: 5 } }}>
      <GalleryPublicSettings />
    </GalleryModelContext>
  );
  expect(screen.getByText('100%')).toBeDefined();
  view.rerender(
    <GalleryModelContext value={{ usageUnavailableReason: 'This host has no allowance service.' }}>
      <GalleryPublicSettings />
    </GalleryModelContext>
  );
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('Usage unavailable');
  expect(screen.queryByText('This host has no allowance service.', { selector: 'p' })).toBeNull();
});
