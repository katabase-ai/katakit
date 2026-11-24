// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { GalleryPrivacyBadge } from './GalleryPrivacyBadge';
import { Gallery } from './Gallery';
import {
  galleryDemoDetails,
  galleryDataHandling,
  requiresGalleryCapability,
} from './galleryDemoDetails';
import { GalleryInferenceProvider } from './GalleryInferenceProvider';
import { GalleryModeProvider, GalleryPreviewToggle } from './GalleryModeProvider';
import { defaultInference, inferenceStorageKey } from './galleryInference';
import type { GalleryModelConnect } from './galleryModel';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test.each(galleryDemoDetails)(
  '$title declares its data handling without a model connection',
  demo => {
    const dataHandling = galleryDataHandling(demo.requiredCapabilities);
    const cloud = dataHandling.transcribedText === 'cloud';
    expect(dataHandling.audio).toBe('device');
    expect(requiresGalleryCapability(demo.requiredCapabilities, 'remoteModel')).toBe(cloud);
    render(<GalleryPrivacyBadge dataHandling={dataHandling} />);
    const button = screen.getByRole('button', { name: cloud ? 'Cloud-assisted' : 'On-device' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(button);
    const popup = screen.getByRole('dialog');
    const rows = within(popup).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toBe('Audio stays on your device');
    expect(rows[1]!.textContent).toBe(
      cloud
        ? 'Transcribed text is processedon cloud servers'
        : 'Transcribed text stayson your device'
    );
    expect(within(popup).queryByRole('link')).toBeNull();
    expect(popup.textContent).not.toContain('secure');
  }
);

test('hover details remain reachable by pointer and keyboard, and Escape restores the trigger', () => {
  vi.useFakeTimers();
  const view = render(
    <GalleryPrivacyBadge
      dataHandling={galleryDataHandling(galleryDemoDetails[2].requiredCapabilities)}
      privacyUrl="https://example.com/privacy"
    />
  );
  const button = screen.getByRole('button', { name: 'Cloud-assisted' });
  const control = button.parentElement!;
  fireEvent.pointerEnter(control, { pointerType: 'mouse' });
  expect(button.getAttribute('aria-expanded')).toBe('true');
  const popup = screen.getByRole('dialog');
  expect(popup.id).toBe(button.getAttribute('aria-controls'));
  const link = within(popup).getByRole('link', { name: /Privacy policy/ });
  expect(link.getAttribute('href')).toBe('https://example.com/privacy');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  // A diagonal pointer path briefly leaves the badge before entering the wider popover.
  fireEvent.pointerLeave(control);
  act(() => vi.advanceTimersByTime(75));
  expect(screen.getByRole('dialog')).toBe(popup);
  fireEvent.pointerEnter(popup, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByRole('dialog')).toBe(popup);
  fireEvent.pointerLeave(control);
  act(() => vi.advanceTimersByTime(151));
  expect(screen.queryByRole('dialog')).toBeNull();

  act(() => button.focus());
  expect(screen.getByRole('dialog')).toBe(popup);
  act(() => link.focus());
  fireEvent.pointerLeave(control);
  expect(screen.getByRole('dialog')).toBe(popup);
  fireEvent.keyDown(link, { key: 'Escape' });
  expect(document.activeElement).toBe(button);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(button.getAttribute('aria-expanded')).toBe('false');
  act(() => button.blur());
  fireEvent.pointerEnter(control, { pointerType: 'mouse' });
  fireEvent.pointerLeave(control);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test('tapping pins the disclosure until another tap or an outside interaction', () => {
  render(
    <>
      <GalleryPrivacyBadge
        dataHandling={galleryDataHandling(galleryDemoDetails[0].requiredCapabilities)}
      />
      <button type="button">Outside</button>
    </>
  );
  const button = screen.getByRole('button', { name: 'On-device' });
  fireEvent.pointerEnter(button.parentElement!, { pointerType: 'touch' });
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(button);
  fireEvent.pointerLeave(button.parentElement!);
  expect(screen.getByRole('dialog')).toBeDefined();
  fireEvent.click(button);
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(button);
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

const hostPromise = 'Transcribed text is processed on secure servers';
const GalleryContent = ({
  demo = galleryDemoDetails[2],
  connectModel,
}: {
  demo?: (typeof galleryDemoDetails)[number];
  connectModel?: GalleryModelConnect;
}) => (
  <Gallery
    demos={galleryDemoDetails}
    activeDemo={demo}
    connectModel={connectModel}
    cloudPrivacyDescription={hostPromise}
    privacyUrl="https://example.com/privacy"
    renderLink={({ children }) => <a href="#demo">{children}</a>}
  >
    <p>Demo content</p>
  </Gallery>
);

test('only managed inference receives host privacy wording; preview never describes the saved developer endpoint', () => {
  window.localStorage.setItem(
    inferenceStorageKey,
    JSON.stringify({ ...defaultInference, source: 'key', key: 'test-key' })
  );
  const connect = vi.fn<GalleryModelConnect>();
  const direct = vi.spyOn(window, 'fetch');
  render(
    <GalleryInferenceProvider>
      <GalleryModeProvider developerMode>
        <GalleryPreviewToggle />
        <GalleryContent connectModel={connect} />
      </GalleryModeProvider>
    </GalleryInferenceProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cloud-assisted' }));
  expect(
    screen.getByText('Transcribed text is processed by your configured service')
  ).toBeDefined();
  expect(screen.queryByText(hostPromise)).toBeNull();
  expect(screen.queryByLabelText('API key')).toBeNull();
  fireEvent.click(screen.getByRole('switch'));
  expect(screen.getByText(hostPromise)).toBeDefined();
  expect(screen.queryByText('Transcribed text is processed by your configured service')).toBeNull();
  expect(screen.queryByLabelText('API key')).toBeNull();
  expect(connect).not.toHaveBeenCalled();
  expect(direct).not.toHaveBeenCalled();
});

test('no managed backend means no host security claim, and navigating closes the previous disclosure', () => {
  const view = render(<GalleryContent />);
  fireEvent.click(screen.getByRole('button', { name: 'Cloud-assisted' }));
  expect(screen.queryByText(hostPromise)).toBeNull();
  view.rerender(<GalleryContent demo={galleryDemoDetails[1]} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: 'On-device' }).getAttribute('aria-expanded')).toBe(
    'false'
  );
  expect(screen.getByRole('link', { name: 'Structured notes' })).toBeDefined();
});
