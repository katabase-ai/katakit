// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { GalleryPublicSettings } from './GalleryPublicSettings';
import { GalleryModelContext } from './galleryModel';

afterEach(cleanup);

test('signup and sign-in use the host actions without exposing provider configuration', () => {
  const onCreateAccount = vi.fn();
  const onLogIn = vi.fn();
  render(
    <GalleryModelContext value={{ account: { onCreateAccount, onLogIn } }}>
      <GalleryPublicSettings privacyUrl="https://katabase.com/privacy" />
    </GalleryModelContext>
  );
  expect(
    screen.getByRole('heading', { name: 'Take your ideas further with Katabase' })
  ).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(onCreateAccount).toHaveBeenCalledOnce();
  expect(onLogIn).toHaveBeenCalledOnce();
  expect(screen.queryByLabelText('API key')).toBeNull();
  expect(screen.queryByRole('navigation', { name: 'Operation views' })).toBeNull();
  const privacy = screen.getByRole('link', { name: 'katabase.com/privacy' });
  expect(privacy.getAttribute('href')).toBe('https://katabase.com/privacy');
  expect(privacy.getAttribute('rel')).toBe('noopener noreferrer');
});

test('missing account services explain availability without simulating registration or sign-in', () => {
  render(<GalleryPublicSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
  expect(screen.getByRole('status').textContent).toBe('Account creation isn’t available here yet.');
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByRole('status').textContent).toBe('Sign-in isn’t available here yet.');
  expect(screen.queryByText(/Signed in as/)).toBeNull();
  expect(screen.queryByRole('link', { name: 'katabase.com/privacy' })).toBeNull();
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
    (screen.getByRole('progressbar', { name: 'Demo allowance used' }) as HTMLProgressElement).value
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
