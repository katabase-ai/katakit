// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { GallerySpeechControls } from './GallerySpeechControls';
import { GalleryModelContext, type GalleryModelConnect } from './galleryModel';
import { galleryUsagePercent } from './GalleryUsageMeter';
import { GalleryUsageProvider, useGalleryUsage } from './GalleryUsageProvider';

afterEach(cleanup);

test.each([
  [100, 0, 'normal'],
  [80, 20, 'normal'],
  [21, 79, 'normal'],
  [20, 80, 'warning'],
  [0.001, 99, 'warning'],
  [0, 100, 'exhausted'],
] as const)(
  'host allowance %s/100 displays %s percent used in the %s phase',
  (remaining, percent, phase) => {
    render(
      <GalleryModelContext value={{ allowance: { remaining, total: 100 } }}>
        <GallerySpeechControls />
      </GalleryModelContext>
    );
    const footer = screen.getByRole('region', { name: 'Operation status' });
    expect(footer.dataset.usagePhase).toBe(phase);
    const progress = screen.getByRole('progressbar', {
      name: 'Demo allowance used',
    }) as HTMLProgressElement;
    expect(progress.value).toBe(percent);
    expect(screen.getByText(`${percent}%`)).toBeDefined();
    fireEvent.focus(screen.getByRole('button', { name: /of your demo allowance/ }));
    expect(screen.getByRole('tooltip').textContent).toContain('on-device transcription does not');
    fireEvent.keyDown(screen.getByRole('button', { name: /of your demo allowance/ }), {
      key: 'Escape',
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  }
);

test.each([
  undefined,
  { remaining: NaN, total: 100 },
  { remaining: 1, total: 0 },
  { remaining: -1, total: 100 },
  { remaining: 101, total: 100 },
  { remaining: 1, total: Infinity },
])('missing or invalid allowance never invents usage: %j', allowance => {
  expect(galleryUsagePercent(allowance)).toBeUndefined();
  render(
    <GalleryModelContext
      value={{ allowance, usageUnavailableReason: 'No host allowance service.' }}
    >
      <GallerySpeechControls />
    </GalleryModelContext>
  );
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.queryByText('Usage unavailable')).toBeNull();
});

test('both modes expose Settings through the host action', () => {
  const openSettings = vi.fn();
  const view = render(
    <GalleryModelContext value={{ isDeveloperView: false, openSettings }}>
      <GallerySpeechControls />
    </GalleryModelContext>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(openSettings).toHaveBeenCalledOnce();
  expect(screen.getByRole('img', { name: 'Microphone off' })).toBeDefined();
  expect(screen.queryByRole('button', { name: /Microphone setup/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Account' })).toBeDefined();
  view.rerender(
    <GalleryModelContext value={{ isDeveloperView: true, openSettings }}>
      <GallerySpeechControls />
    </GalleryModelContext>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(openSettings).toHaveBeenCalledTimes(2);
});

test('guest account actions use the host callbacks and Escape dismisses the panel', () => {
  const onCreateAccount = vi.fn();
  const onLogIn = vi.fn();
  render(
    <GalleryModelContext value={{ account: { onCreateAccount, onLogIn } }}>
      <GallerySpeechControls />
    </GalleryModelContext>
  );
  const avatar = screen.getByRole('button', { name: 'Create a free account or log in' });
  fireEvent.click(avatar);
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Create account' })
  );
  expect(onCreateAccount).toHaveBeenCalledOnce();
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(avatar);
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
  expect(onLogIn).toHaveBeenCalledOnce();
  fireEvent.click(avatar);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(avatar);
});

test('signed-in identity shows initials and only the real account action', () => {
  const onOpenAccount = vi.fn();
  render(
    <GalleryModelContext
      value={{
        account: { user: { name: 'Ada Lovelace' }, onOpenAccount },
        allowance: { remaining: 0, total: 100 },
      }}
    >
      <GallerySpeechControls />
    </GalleryModelContext>
  );
  expect(screen.getByRole('region', { name: 'Operation status' }).dataset.guest).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: 'Account: Ada Lovelace' }));
  expect(screen.getByText('AL')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Create account' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Manage account' }));
  expect(onOpenAccount).toHaveBeenCalledOnce();
});

test('a host without account integration explains availability instead of offering fake auth', () => {
  render(<GallerySpeechControls />);
  fireEvent.click(screen.getByRole('button', { name: 'Account' }));
  const panel = screen.getByRole('dialog');
  expect(
    within(panel).getByText('Account access is not available in this gallery host.')
  ).toBeDefined();
  expect(within(panel).queryByRole('button')).toBeNull();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('shared allowance ignores invalid reports, clears on source abort, and rejects stale updates', () => {
  let usage!: NonNullable<ReturnType<typeof useGalleryUsage>>;
  const Consumer = () => {
    usage = useGalleryUsage()!;
    return null;
  };
  render(
    <GalleryUsageProvider>
      <Consumer />
    </GalleryUsageProvider>
  );
  const source = vi.fn<GalleryModelConnect>();
  const lifetime = new AbortController();
  act(() => usage.reportAllowance(source, lifetime.signal, { remaining: 20, total: 100 }));
  expect(usage.report?.allowance).toEqual({ remaining: 20, total: 100 });
  act(() => usage.reportAllowance(source, lifetime.signal, { remaining: -1, total: 100 }));
  expect(usage.report?.allowance).toBeUndefined();
  act(() => lifetime.abort());
  expect(usage.report).toBeUndefined();
  act(() => usage.reportAllowance(source, lifetime.signal, { remaining: 0, total: 100 }));
  expect(usage.report).toBeUndefined();
});
