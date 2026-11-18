// @vitest-environment happy-dom
import { useCallback, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Gallery } from './Gallery';
import { GallerySpeechProvider } from './GallerySpeechProvider';
import { GallerySpeechControls } from './GallerySpeechControls';
import { GalleryModeProvider, GalleryPreviewToggle, useGalleryMode } from './GalleryModeProvider';
import type { GalleryDeveloperPage } from './operationDetails';
import { galleryDemoDetails } from './galleryDemoDetails';
import { GalleryModelError, useGalleryModel, type GalleryModelConnect } from './galleryModel';
import { defaultInference, inferenceStorageKey } from './galleryInference';
import { NotesDemo } from '../../notes-react/src/NotesDemo';
import { createNotesDemo } from '../../notes-react/src/createNotesDemo';
import { NotesRequestError, type NotesConnection } from '../../notes-react/src/notesModel';

const completion = (text?: string) => ({
  choices: [
    {
      finish_reason: 'stop',
      message: { content: JSON.stringify({ additions: text ? [{ text }] : [], rewords: [] }) },
    },
  ],
});
const savedKey = () =>
  window.localStorage.setItem(
    inferenceStorageKey,
    JSON.stringify({ ...defaultInference, source: 'key', key: 'test-developer-key' })
  );
const Notes = ({ runtime }: { runtime: ReturnType<typeof createNotesDemo> }) => {
  const model = useGalleryModel();
  const connect = useCallback(
    async ({ signal }: { signal: AbortSignal }): Promise<NotesConnection> => {
      const connection = await model.connect!({ signal });
      return {
        ...connection,
        requestCompletion: async request => {
          try {
            return await connection.requestCompletion(request);
          } catch (error) {
            throw error instanceof GalleryModelError
              ? new NotesRequestError(error.message, error.policy)
              : error;
          }
        },
      };
    },
    [model.connect]
  );
  return (
    <NotesDemo
      runtime={runtime}
      listening
      connect={model.connect && connect}
      renderModelControls={model.renderControls}
      connectionHelp={
        <p>
          No managed inference is available.
          {model.configure && (
            <button type="button" onClick={() => model.configure?.('inference')}>
              Configure inference
            </button>
          )}
        </p>
      }
    />
  );
};
const Content = ({
  runtime,
  connectModel,
  initialPage,
}: {
  runtime: ReturnType<typeof createNotesDemo>;
  connectModel?: GalleryModelConnect;
  initialPage?: GalleryDeveloperPage;
}) => {
  const [page, setPage] = useState<GalleryDeveloperPage | 'settings' | undefined>(initialPage);
  const { isDeveloperView } = useGalleryMode();
  return (
    <>
      <GalleryPreviewToggle />
      <Gallery
        demos={galleryDemoDetails}
        activeDemo={galleryDemoDetails[2]}
        developerPage={page === 'settings' ? undefined : page}
        settingsPage={page === 'settings'}
        onOpenSettings={() => setPage(isDeveloperView ? 'setup' : 'settings')}
        input={<GallerySpeechControls />}
        connectModel={connectModel}
        onConfigureOperation={() => setPage('setup')}
        renderDeveloperLink={({ page: destination, children, current }) => (
          <button
            type="button"
            aria-current={current ? 'page' : undefined}
            onClick={() => setPage(destination)}
          >
            {children}
          </button>
        )}
        renderLink={({ children, current }) => (
          <a
            href="#demo"
            aria-current={current ? 'page' : undefined}
            onClick={event => {
              event.preventDefault();
              setPage(undefined);
            }}
          >
            {children}
          </a>
        )}
      >
        <Notes runtime={runtime} />
      </Gallery>
    </>
  );
};
const View = ({
  developerMode = false,
  ...props
}: Parameters<typeof Content>[0] & { developerMode?: boolean }) => (
  <GallerySpeechProvider>
    <GalleryModeProvider developerMode={developerMode}>
      <Content {...props} />
    </GalleryModeProvider>
  </GallerySpeechProvider>
);
const turn = (runtime: ReturnType<typeof createNotesDemo>, text: string) => {
  runtime.ingestSegment({ id: crypto.randomUUID(), sourceId: 'test', text });
  runtime.flush();
};
const hostConnection = (
  requestCompletion: NotesConnection['requestCompletion']
): NotesConnection => ({
  model: 'host/model',
  maxBodyBytes: 65536,
  maxOutputTokens: 1024,
  requestCompletion,
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
});

test('public mode ignores saved developer keys and visitor flags, and uses only host inference', async () => {
  savedKey();
  window.localStorage.setItem('katakit.gallery.developer', 'true');
  window.history.replaceState(null, '', '/?dev=true');
  const runtime = createNotesDemo();
  const request = vi.fn<NotesConnection['requestCompletion']>(async () =>
    completion('Public note')
  );
  const host = vi.fn<GalleryModelConnect>(async ({ verification, onAllowance }) => {
    expect(verification.isConnected).toBe(true);
    onAllowance({ remaining: 4, total: 5 });
    return hostConnection(request);
  });
  const direct = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', direct);
  const view = render(<View runtime={runtime} connectModel={host} />);
  await screen.findByText('Usage unavailable');
  expect(screen.queryByRole('switch')).toBeNull();
  expect(screen.getByRole('button', { name: 'Settings' })).toBeDefined();
  expect(screen.queryByLabelText('API key')).toBeNull();
  expect(screen.queryByRole('button', { name: /Configure inference|Add API key/ })).toBeNull();
  act(() => turn(runtime, 'A public thought.'));
  expect(host).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Start notes' }));
  await screen.findByText('Public note');
  expect(host).toHaveBeenCalledOnce();
  expect(
    (screen.getByRole('progressbar', { name: 'Demo allowance used' }) as HTMLProgressElement).value
  ).toBe(20);
  expect(direct).not.toHaveBeenCalled();
  expect(JSON.parse(request.mock.calls[0]![0].body).model).toBe('host/model');
  expect(window.localStorage.getItem(inferenceStorageKey)).toContain('test-developer-key');
  view.unmount();
  runtime.close();
});

test('developer setup exposes the model alongside the key, keeps only the endpoint advanced, and persists/removes settings', async () => {
  const runtime = createNotesDemo();
  const direct = vi.fn<typeof fetch>(async () => Response.json(completion()));
  vi.stubGlobal('fetch', direct);
  const view = render(<View developerMode initialPage="setup" runtime={runtime} />);
  const model = await screen.findByLabelText('Model ID');
  expect(model.closest('details')).toBeNull();
  expect(screen.getByLabelText('API key').closest('details')).toBeNull();
  expect(screen.getByLabelText('Chat-completions endpoint').closest('details')!.open).toBe(false);
  fireEvent.change(model, { target: { value: 'custom/model' } });
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'test-saved-key' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText('Inference settings saved. Start notes in a demo when ready.');
  expect(JSON.parse(window.localStorage.getItem(inferenceStorageKey)!)).toMatchObject({
    key: 'test-saved-key',
    model: 'custom/model',
  });
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'React demos' })).getByRole('link', {
      name: 'Structured notes',
    })
  );
  act(() => turn(runtime, 'Test the selected model.'));
  fireEvent.click(screen.getByRole('button', { name: 'Start notes' }));
  await vi.waitFor(() => expect(direct).toHaveBeenCalledOnce());
  expect(JSON.parse(direct.mock.calls[0]![1]!.body as string).model).toBe('custom/model');
  view.unmount();
  runtime.close();
  const fresh = createNotesDemo();
  const reloaded = render(<View developerMode initialPage="setup" runtime={fresh} />);
  expect(((await screen.findByLabelText('Model ID')) as HTMLInputElement).value).toBe(
    'custom/model'
  );
  expect((screen.getByLabelText('API key') as HTMLInputElement).value).toBe('test-saved-key');
  fireEvent.click(screen.getByRole('button', { name: 'Remove key' }));
  expect(window.localStorage.getItem(inferenceStorageKey)).toBeNull();
  expect((screen.getByLabelText('API key') as HTMLInputElement).value).toBe('');
  reloaded.unmount();
  fresh.close();
});

test('public preview aborts BYOK, ignores late results, preserves content/settings and requires explicit starts in both directions', async () => {
  savedKey();
  const runtime = createNotesDemo();
  let finish!: (response: Response) => void;
  const direct = vi.fn<typeof fetch>(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  vi.stubGlobal('fetch', direct);
  let hostSignal!: AbortSignal;
  const host = vi.fn<GalleryModelConnect>(async ({ signal }) => {
    hostSignal = signal;
    return hostConnection(async () => completion('Managed note'));
  });
  const view = render(<View developerMode runtime={runtime} connectModel={host} />);
  act(() => turn(runtime, 'Keep these local words.'));
  fireEvent.click(screen.getByRole('button', { name: 'Start notes' }));
  await vi.waitFor(() => expect(direct).toHaveBeenCalledOnce());
  expect((screen.getByRole('switch', { name: 'Developer mode' }) as HTMLInputElement).checked).toBe(
    false
  );
  fireEvent.click(screen.getByRole('switch', { name: 'Developer mode' }));
  expect((screen.getByRole('switch', { name: 'Public preview' }) as HTMLInputElement).checked).toBe(
    true
  );
  expect(direct.mock.calls[0]![1]!.signal!.aborted).toBe(true);
  expect(screen.getByRole('button', { name: 'Settings' })).toBeDefined();
  expect(runtime.state$.get().notes.turns).toHaveLength(1);
  await act(async () => {
    finish(Response.json(completion('Obsolete developer note')));
  });
  expect(runtime.state$.get().notes.notes).toEqual([]);
  expect(host).not.toHaveBeenCalled();
  expect(window.localStorage.getItem(inferenceStorageKey)).toContain('test-developer-key');
  fireEvent.click(screen.getByRole('button', { name: 'Start notes' }));
  await screen.findByText('Managed note');
  fireEvent.click(screen.getByRole('switch', { name: 'Public preview' }));
  expect((screen.getByRole('switch', { name: 'Developer mode' }) as HTMLInputElement).checked).toBe(
    false
  );
  expect(hostSignal.aborted).toBe(true);
  expect(runtime.state$.get().notes.notes[0]?.text).toBe('Managed note');
  expect(screen.getByRole('button', { name: 'Settings' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Start notes' })).toBeDefined();
  expect(direct).toHaveBeenCalledOnce();
  expect(host).toHaveBeenCalledOnce();
  view.unmount();
  runtime.close();
});

test('a public preview without host inference never falls back to the saved developer key', async () => {
  savedKey();
  const runtime = createNotesDemo();
  const direct = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', direct);
  const view = render(<View developerMode runtime={runtime} />);
  await vi.waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Start notes' }) as HTMLButtonElement).disabled
    ).toBe(false)
  );
  fireEvent.click(screen.getByRole('switch', { name: 'Developer mode' }));
  expect((screen.getByRole('button', { name: 'Start notes' }) as HTMLButtonElement).disabled).toBe(
    true
  );
  expect(screen.getByText('Usage unavailable')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Configure inference' })).toBeNull();
  act(() => turn(runtime, 'Still local.'));
  expect(direct).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('switch', { name: 'Public preview' }));
  expect((screen.getByRole('button', { name: 'Start notes' }) as HTMLButtonElement).disabled).toBe(
    false
  );
  expect(runtime.state$.get().notes.turns).toHaveLength(1);
  view.unmount();
  runtime.close();
});

test.each([true, false])(
  'cross-tab key removal cannot be undone by a stale operation setup form (managed host: %s)',
  async managed => {
    savedKey();
    const runtime = createNotesDemo();
    const view = render(
      <View
        developerMode
        initialPage="setup"
        runtime={runtime}
        connectModel={managed ? vi.fn() : undefined}
      />
    );
    expect(((await screen.findByLabelText('API key')) as HTMLInputElement).value).toBe(
      'test-developer-key'
    );
    act(() => {
      window.localStorage.removeItem(inferenceStorageKey);
      window.dispatchEvent(new StorageEvent('storage', { key: inferenceStorageKey }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(window.localStorage.getItem(inferenceStorageKey) ?? '').not.toContain(
      'test-developer-key'
    );
    view.unmount();
    runtime.close();
  }
);

test('developer operation grid uses catalogue requirements, remains navigable and opens setup', async () => {
  const runtime = createNotesDemo();
  const view = render(<View developerMode initialPage="grid" runtime={runtime} />);
  const table = await screen.findByRole('table');
  expect(within(table).queryByRole('button')).toBeNull();
  expect(within(table).getAllByRole('link')).toHaveLength(galleryDemoDetails.length);
  expect(
    within(table).getAllByRole('img', { name: 'Transcription: Required · configured' })
  ).toHaveLength(4);
  const game = within(table).getByRole('row', { name: /Color Clash/ });
  expect(within(game).getByRole('link', { name: 'Color Clash' })).toBeDefined();
  expect(within(game).getByRole('img', { name: 'Text generation: Not used' })).toBeDefined();
  expect(
    within(table).getByRole('img', { name: 'Text generation: Required · needs a connection' })
  ).toBeDefined();
  expect(screen.queryByText('Diarization')).toBeNull();
  expect(screen.queryByRole('button', { name: /Sign up/ })).toBeNull();
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Operation views' })).getByRole('button', {
      name: 'Configuration',
    })
  );
  await screen.findByLabelText('Model ID');
  view.unmount();
  runtime.close();
});

test('reported usage stays live without restarting inference, survives navigation, and clears on mode change', async () => {
  const runtime = createNotesDemo();
  let report!: Parameters<GalleryModelConnect>[0]['onAllowance'];
  const host = vi.fn<GalleryModelConnect>(async ({ onAllowance }) => {
    report = onAllowance;
    onAllowance({ remaining: 4, total: 5 });
    return hostConnection(async () => completion());
  });
  const view = render(<View developerMode runtime={runtime} connectModel={host} />);
  await screen.findByText('Usage unavailable');
  act(() => turn(runtime, 'First thought.'));
  fireEvent.click(screen.getByRole('button', { name: 'Start notes' }));
  await screen.findByText('20%');
  act(() => report({ remaining: 1, total: 5 }));
  expect(screen.getByText('80%')).toBeDefined();
  expect(host).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Pause notes' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  await screen.findByRole('heading', { name: 'Configure models' });
  const tabs = within(screen.getByRole('navigation', { name: 'Operation views' }));
  expect(tabs.getByRole('button', { name: 'Configuration' }).getAttribute('aria-current')).toBe(
    'page'
  );
  fireEvent.click(tabs.getByRole('button', { name: 'Grid' }));
  await screen.findByRole('table');
  expect(tabs.getByRole('button', { name: 'Grid' }).getAttribute('aria-current')).toBe('page');
  expect(screen.getByText('80%')).toBeDefined();
  // The outgoing demo's callback cannot replace the retained host-session report.
  act(() => report({ remaining: 0, total: 5 }));
  expect(screen.getByText('80%')).toBeDefined();
  fireEvent.click(screen.getByRole('switch', { name: 'Developer mode' }));
  expect(screen.getByText('Usage unavailable')).toBeDefined();
  expect(screen.queryByRole('progressbar', { name: 'Demo allowance used' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Settings' })).toBeDefined();
  view.unmount();
  runtime.close();
});

test('public Settings opens account content, shares allowance with the footer, and aborts the outgoing demo connection', async () => {
  savedKey();
  const runtime = createNotesDemo();
  let visitSignal!: AbortSignal;
  const host = vi.fn<GalleryModelConnect>(async ({ signal, onAllowance }) => {
    visitSignal = signal;
    onAllowance({ remaining: 1, total: 5 });
    return hostConnection(async () => completion());
  });
  const view = render(<View runtime={runtime} connectModel={host} />);
  await screen.findByText('Usage unavailable');
  act(() => turn(runtime, 'A thought before Settings.'));
  fireEvent.click(screen.getByRole('button', { name: 'Start notes' }));
  await screen.findByText('80%');
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  await screen.findByRole('heading', { name: 'Settings' });
  expect(visitSignal.aborted).toBe(true);
  expect(screen.getByRole('button', { name: 'Create an account' })).toBeDefined();
  expect(screen.queryByLabelText('API key')).toBeNull();
  expect(screen.queryByRole('navigation', { name: 'Operation views' })).toBeNull();
  expect(
    screen
      .getAllByRole('progressbar', { name: 'Demo allowance used' })
      .map(element => (element as HTMLProgressElement).value)
  ).toEqual([80, 80]);
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'React demos' })).getByRole('link', {
      name: 'Structured notes',
    })
  );
  expect(screen.getByRole('button', { name: 'Start notes' })).toBeDefined();
  expect(host).toHaveBeenCalledOnce();
  expect(screen.getByText('80%')).toBeDefined();
  view.unmount();
  runtime.close();
});
