// @vitest-environment happy-dom
import { useCallback } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Gallery } from './Gallery';
import { GallerySpeechProvider } from './GallerySpeechProvider';
import { GallerySpeechControls } from './GallerySpeechControls';
import { galleryDemoDetails } from './galleryDemoDetails';
import { GalleryModelError, useGalleryModel, type GalleryModelConnect } from './galleryModel';
import { inferenceStorageKey } from './galleryInference';
import { NotesDemo } from '../../notes-react/src/NotesDemo';
import { createNotesDemo } from '../../notes-react/src/createNotesDemo';
import { NotesRequestError, type NotesConnection } from '../../notes-react/src/notesModel';

const completion = {
  choices: [
    { finish_reason: 'stop', message: { content: JSON.stringify({ additions: [], rewords: [] }) } },
  ],
};
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
    />
  );
};
const View = ({
  runtime,
  connectModel,
}: {
  runtime: ReturnType<typeof createNotesDemo>;
  connectModel?: GalleryModelConnect;
}) => (
  <GallerySpeechProvider>
    <Gallery
      demos={galleryDemoDetails}
      activeDemo={galleryDemoDetails[2]}
      input={<GallerySpeechControls />}
      connectModel={connectModel}
      renderLink={({ children, current }) => (
        <a href="#demo" aria-current={current ? 'page' : undefined}>
          {children}
        </a>
      )}
    >
      <Notes runtime={runtime} />
    </Gallery>
  </GallerySpeechProvider>
);
const turn = (runtime: ReturnType<typeof createNotesDemo>, text: string) => {
  runtime.ingestSegment({ id: crypto.randomUUID(), sourceId: 'test', text });
  runtime.flush();
};
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

test('shared key settings cancel hosted work, use the real schema transport without allowance, persist and remove', async () => {
  const runtime = createNotesDemo();
  let finishHost!: (value: unknown) => void;
  let hostSignal!: AbortSignal;
  const host = vi.fn<GalleryModelConnect>(async ({ signal, verification, onAllowance }) => {
    hostSignal = signal;
    expect(verification.isConnected).toBe(true);
    onAllowance({ remaining: 4, total: 5 });
    return {
      model: 'host/model',
      maxBodyBytes: 65536,
      maxOutputTokens: 1024,
      requestCompletion: () =>
        new Promise(resolve => {
          finishHost = resolve;
        }),
    };
  });
  const direct = vi.fn<typeof fetch>(async () => Response.json(completion));
  vi.stubGlobal('fetch', direct);
  const view = render(<View runtime={runtime} connectModel={host} />);
  await screen.findByRole('button', { name: 'Free demo ▾' });
  const nav = screen.getByRole('navigation');
  expect(within(nav).getByRole('link', { name: 'Welcome' })).toBeDefined();
  expect(within(nav).getAllByRole('link')).toHaveLength(4);
  expect(within(nav).queryByRole('button')).toBeNull();
  act(() => turn(runtime, 'A pending thought.'));
  expect(host).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Start notes' }));
  await screen.findByText('4 / 5 requests left');
  fireEvent.click(screen.getByRole('button', { name: 'Free demo ▾' }));
  fireEvent.click(screen.getByRole('radio', { name: 'My API key' }));
  expect(screen.getByText('Advanced').closest('details')!.open).toBe(false);
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'test-saved-key' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(hostSignal.aborted).toBe(true);
  await act(async () => {
    finishHost(completion);
  });
  expect(direct).not.toHaveBeenCalled();
  expect(screen.queryByText('4 / 5 requests left')).toBeNull();
  expect(JSON.parse(window.localStorage.getItem(inferenceStorageKey)!).key).toBe('test-saved-key');
  fireEvent.click(screen.getByRole('button', { name: 'Start notes' }));
  await vi.waitFor(() => expect(direct).toHaveBeenCalledOnce());
  const body = JSON.parse(direct.mock.calls[0]![1]!.body as string);
  expect(body.response_format.json_schema.strict).toBe(true);
  expect(body.response_format.json_schema.schema.properties).toHaveProperty('additions');
  expect(body.messages[1].content).toContain('A pending thought.');
  expect(host).toHaveBeenCalledOnce();
  view.unmount();
  runtime.close();

  // A new root represents reload/tab reopening: same saved provider, fresh demo content.
  const fresh = createNotesDemo();
  const reloaded = render(<View runtime={fresh} connectModel={host} />);
  await screen.findByRole('button', { name: 'My key ▾' });
  fireEvent.click(screen.getByRole('button', { name: 'My key ▾' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove key' }));
  expect(window.localStorage.getItem(inferenceStorageKey)).toBeNull();
  expect(screen.getByRole('button', { name: 'Free demo ▾' })).toBeDefined();
  expect(host).toHaveBeenCalledOnce();
  reloaded.unmount();
  fresh.close();
});

test('missing-host and browser storage changes keep navigation and local content available without starting notes', async () => {
  const runtime = createNotesDemo();
  const view = render(<View runtime={runtime} />);
  await screen.findByRole('button', { name: 'Add API key ▾' });
  expect(screen.getByText(/No model connection is configured/)).toBeDefined();
  expect((screen.getByRole('button', { name: 'Start notes' }) as HTMLButtonElement).disabled).toBe(
    true
  );
  act(() => turn(runtime, 'Locally retained.'));
  fireEvent.click(screen.getByRole('button', { name: 'Add API key ▾' }));
  expect((screen.getByRole('radio', { name: 'Free demo' }) as HTMLInputElement).disabled).toBe(
    true
  );
  fireEvent.click(screen.getByRole('radio', { name: 'My API key' }));
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'test-key' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect((screen.getByRole('button', { name: 'Start notes' }) as HTMLButtonElement).disabled).toBe(
    false
  );
  act(() => {
    window.localStorage.removeItem(inferenceStorageKey);
    window.dispatchEvent(new StorageEvent('storage', { key: inferenceStorageKey }));
  });
  expect(runtime.state$.get().notes.turns).toHaveLength(1);
  expect((screen.getByRole('button', { name: 'Start notes' }) as HTMLButtonElement).disabled).toBe(
    true
  );
  expect(screen.getByRole('button', { name: 'Add API key ▾' })).toBeDefined();
  view.unmount();
  runtime.close();
});

test('another tab removing a key cannot be undone by saving a stale open settings dialog', async () => {
  const runtime = createNotesDemo();
  const view = render(<View runtime={runtime} connectModel={vi.fn()} />);
  await screen.findByRole('button', { name: 'Free demo ▾' });
  fireEvent.click(screen.getByRole('button', { name: 'Free demo ▾' }));
  fireEvent.click(screen.getByRole('radio', { name: 'My API key' }));
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'old-key' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  fireEvent.click(screen.getByRole('button', { name: 'My key ▾' }));
  expect((screen.getByLabelText('API key') as HTMLInputElement).value).toBe('old-key');

  act(() => {
    window.localStorage.removeItem(inferenceStorageKey);
    window.dispatchEvent(new StorageEvent('storage', { key: inferenceStorageKey }));
  });
  expect(screen.queryByLabelText('API key')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(window.localStorage.getItem(inferenceStorageKey)).not.toContain('old-key');
  view.unmount();
  runtime.close();
});

test('a dialog left open cannot restore a key removed in another tab', async () => {
  const runtime = createNotesDemo();
  const view = render(<View runtime={runtime} />);
  await screen.findByRole('button', { name: 'Add API key ▾' });
  fireEvent.click(screen.getByRole('button', { name: 'Add API key ▾' }));
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'first-key' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  fireEvent.click(screen.getByRole('button', { name: 'My key ▾' }));
  expect((screen.getByLabelText('API key') as HTMLInputElement).value).toBe('first-key');
  act(() => {
    window.localStorage.removeItem(inferenceStorageKey);
    window.dispatchEvent(new StorageEvent('storage', { key: inferenceStorageKey }));
  });
  expect((screen.getByLabelText('API key') as HTMLInputElement).value).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(window.localStorage.getItem(inferenceStorageKey)).toBeNull();
  view.unmount();
  runtime.close();
});
