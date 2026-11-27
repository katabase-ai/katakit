// @vitest-environment happy-dom
import { lazy, Suspense, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Gallery } from '../shared/Gallery';
import { bingoGalleryDemo } from '../shared/galleryDemos';
import { GalleryModeProvider, GalleryPreviewToggle } from '../shared/GalleryModeProvider';
import { useLocalInference } from './localInference';
import { usePreviewInference } from './previewInference';
import { GalleryPage } from './GalleryPage';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  ClientOnly: ({ children }: { children: ReactNode }) => children,
  Link: () => null,
  Navigate: () => null,
}));
vi.mock('../shared/Gallery', () => ({ Gallery: vi.fn(() => null) }));
vi.mock('./localInference', () => ({ useLocalInference: vi.fn() }));
vi.mock('./previewInference', () => ({ usePreviewInference: vi.fn() }));
vi.mock('@katakit/react', () => ({ KatakitDevTools: () => <button>Katakit devtools</button> }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

test('public demos include devtools and switching gallery modes preserves the timeline', async () => {
  vi.mocked(Gallery).mockImplementation(({ children }) => <Suspense>{children}</Suspense>);
  const demo = {
    ...bingoGalleryDemo,
    component: lazy(async () => ({ default: () => <input aria-label="Demo input" /> })),
  };
  const page = (developerMode: boolean) => (
    <GalleryModeProvider developerMode={developerMode}>
      <GalleryPreviewToggle />
      <GalleryPage demo={demo} />
    </GalleryModeProvider>
  );
  const view = render(page(false));
  const launcher = await screen.findByRole('button', { name: 'Katakit devtools' });
  const input = screen.getByRole('textbox');
  view.rerender(page(true));
  fireEvent.click(screen.getByRole('switch'));
  expect(screen.getByRole('button', { name: 'Katakit devtools' })).toBe(launcher);
  expect(screen.getByRole('textbox')).toBe(input);
  fireEvent.click(screen.getByRole('switch'));
  expect(screen.getByRole('button', { name: 'Katakit devtools' })).toBe(launcher);
  expect(screen.getByRole('textbox')).toBe(input);
});

test.each([false, true])(
  'the deployed preview connection is available with developer mode %s',
  developerMode => {
    const connect = vi.fn();
    vi.mocked(usePreviewInference).mockReturnValue(connect);
    render(
      <GalleryModeProvider developerMode={developerMode}>
        <GalleryPreviewToggle />
        <GalleryPage />
      </GalleryModeProvider>
    );
    const props = vi.mocked(Gallery).mock.calls.at(-1)![0];
    expect(props.connectModel).toBe(connect);
    expect(props.modelConnectionLabel).toBeUndefined();
    expect(props.cloudPrivacyDescription).toContain('Katabase’s demo service');
    expect(useLocalInference).toHaveBeenLastCalledWith(developerMode);
    if (developerMode) fireEvent.click(screen.getByRole('switch'));
    expect(vi.mocked(Gallery).mock.calls.at(-1)![0].connectModel).toBe(connect);
    expect(useLocalInference).toHaveBeenLastCalledWith(false);
    expect(connect).not.toHaveBeenCalled();
  }
);

test('local developer inference keeps its server label and neutral privacy wording', () => {
  const connect = vi.fn();
  vi.mocked(useLocalInference).mockImplementation(enabled => (enabled ? connect : undefined));
  const view = render(
    <GalleryModeProvider developerMode>
      <GalleryPage />
    </GalleryModeProvider>
  );
  let props = vi.mocked(Gallery).mock.calls.at(-1)![0];
  expect(props.connectModel).toBe(connect);
  expect(props.modelConnectionLabel).toBe('Server environment');
  expect(props.cloudPrivacyDescription).toBeUndefined();
  view.rerender(
    <GalleryModeProvider developerMode={false}>
      <GalleryPage />
    </GalleryModeProvider>
  );
  props = vi.mocked(Gallery).mock.calls.at(-1)![0];
  expect(props.connectModel).toBeUndefined();
  expect(props.cloudPrivacyDescription).toBeUndefined();
  expect(connect).not.toHaveBeenCalled();
});

test('without an inference connection, the gallery makes no managed-service privacy claim', () => {
  render(
    <GalleryModeProvider developerMode={false}>
      <GalleryPage />
    </GalleryModeProvider>
  );
  const props = vi.mocked(Gallery).mock.calls.at(-1)![0];
  expect(props.connectModel).toBeUndefined();
  expect(props.cloudPrivacyDescription).toBeUndefined();
});
