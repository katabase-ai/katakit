// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { MicrophoneOptions } from '@katakit/transcription/browser';
import { Gallery } from './Gallery';
import { GallerySpeechProvider } from './GallerySpeechProvider';
import { BrainstormGalleryDemo } from './BrainstormGalleryDemo';
import { brainstormDemoDetails } from './galleryDemoDetails';
import { App } from '../../brainstorm-react/src/App';

const capture = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@katakit/transcription/browser', async importOriginal => ({
  ...(await importOriginal<typeof import('@katakit/transcription/browser')>()),
  createMicrophoneTranscriber: (options: MicrophoneOptions) => capture.create(options),
}));
afterEach(() => {
  cleanup();
  capture.create.mockReset();
});

const deferred = <T,>() => {
  let complete!: (value: T) => void;
  const promise = new Promise<T>(resolve => {
    complete = resolve;
  });
  return { promise, resolve: complete };
};
const microphone = () => {
  const ready = deferred<void>();
  let callbacks!: MicrophoneOptions;
  let disposed = false;
  let sourceId = 'test-mic';
  const start = vi.fn(async (input?: { sourceId?: string }) => {
    sourceId = input?.sourceId ?? sourceId;
    callbacks.onState?.({ phase: 'loading', progress: 0.5 });
    await ready.promise;
    if (!disposed) callbacks.onState?.({ phase: 'running' });
  });
  const stop = vi.fn(async () => {
    callbacks.onFinal({ id: crypto.randomUUID(), sourceId, text: 'seal' });
    callbacks.onStop?.();
    callbacks.onState?.({ phase: 'ready' });
  });
  const dispose = vi.fn(async () => {
    disposed = true;
    ready.resolve();
  });
  capture.create.mockImplementation((options: MicrophoneOptions) => {
    callbacks = options;
    return { load: async () => {}, start, stop, dispose };
  });
  return {
    ready,
    start,
    stop,
    dispose,
    final: () => callbacks.onFinal({ id: crypto.randomUUID(), sourceId, text: 'seal' }),
  };
};

test('the real gallery adapter has one round action, waits for both services, and drains final speech', async () => {
  const mic = microphone();
  const admission = deferred<{
    model: string;
    maxBodyBytes: number;
    maxOutputTokens: number;
    requestCompletion: ReturnType<typeof vi.fn>;
  }>();
  const request = vi.fn().mockResolvedValue({
    choices: [
      {
        finish_reason: 'stop',
        message: { content: JSON.stringify({ answers: [{ text: 'Seal', evidence: 'seal' }] }) },
      },
    ],
  });
  const connect = vi.fn(() => admission.promise);
  const view = render(
    <GallerySpeechProvider>
      <Gallery
        demos={[brainstormDemoDetails]}
        activeDemo={brainstormDemoDetails}
        connectModel={connect}
        onOpenSettings={() => {}}
        renderLink={({ children }) => <a href="#demo">{children}</a>}
      >
        <BrainstormGalleryDemo />
      </Gallery>
    </GallerySpeechProvider>
  );
  const start = await screen.findByRole('button', { name: 'Start round' });
  expect(screen.getAllByRole('button', { name: 'Start round' })).toHaveLength(1);
  expect(
    within(screen.getByRole('group', { name: 'Demo controls' })).getByRole('button', {
      name: 'Start round',
    })
  ).toBe(start);
  expect(screen.queryByRole('button', { name: 'Start listening' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Connect judge' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Configure inference' })).toBeNull();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.getByText('Run locally')).toBeDefined();
  fireEvent.click(start);
  await screen.findByText('Downloading speech model… 50%');
  expect(connect).not.toHaveBeenCalled();
  expect(screen.getByRole('timer').textContent).toBe('1:00');
  expect(screen.queryByText('Name ocean animals.')).toBeNull();
  await act(async () => {
    mic.ready.resolve();
  });
  expect(connect).toHaveBeenCalledOnce();
  expect(screen.getByText('Connecting judge…')).toBeDefined();
  act(() => mic.final());
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByRole('timer').textContent).toBe('1:00');
  expect(screen.queryByText('Name ocean animals.')).toBeNull();
  await act(async () => {
    admission.resolve({
      model: 'test',
      maxBodyBytes: 16384,
      maxOutputTokens: 1024,
      requestCompletion: request,
    });
  });
  const end = screen.getByRole('button', { name: 'End round' });
  expect(end).toBe(start);
  expect(screen.queryByRole('button', { name: /Pause/ })).toBeNull();
  expect(screen.getByRole('heading', { name: 'Name ocean animals.' })).toBeDefined();
  fireEvent.click(end);
  await screen.findByRole('button', { name: 'Remove Seal' });
  expect(mic.stop).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Next round' })).toBe(start);
  view.unmount();
  await act(async () => {});
});

test('standalone cancellation disposes pending capture and a late old callback cannot finish the next round', async () => {
  const old = microphone();
  const connect = async () => ({
    model: 'test',
    maxBodyBytes: 16384,
    maxOutputTokens: 1024,
    requestCompletion: vi.fn(),
  });
  const view = render(<App connect={connect} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start round' }));
  await screen.findByText('Downloading speech model… 50%');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel setup' }));
  await act(async () => {});
  expect(old.dispose).toHaveBeenCalledOnce();
  expect(screen.getByRole('heading', { name: 'Ready when you are.' })).toBeDefined();
  expect(screen.getByRole('timer').textContent).toBe('1:00');
  const next = microphone();
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {
    next.ready.resolve();
  });
  expect(screen.getByRole('button', { name: 'End round' })).toBeDefined();
  act(() => old.final());
  expect(screen.queryByRole('button', { name: 'Remove Seal' })).toBeNull();
  view.unmount();
  await act(async () => {});
  expect(next.dispose).toHaveBeenCalledOnce();
});

test('the gallery requires a model connection and has no alternative input or judging mode', async () => {
  microphone();
  const view = render(
    <GallerySpeechProvider>
      <Gallery
        demos={[brainstormDemoDetails]}
        activeDemo={brainstormDemoDetails}
        onOpenSettings={() => {}}
        renderLink={({ children }) => <a href="#demo">{children}</a>}
      >
        <BrainstormGalleryDemo />
      </Gallery>
    </GallerySpeechProvider>
  );
  const start = await screen.findByRole('button', { name: 'Start round' });
  expect(start.hasAttribute('disabled')).toBe(true);
  fireEvent.click(start);
  expect(capture.create).not.toHaveBeenCalled();
  expect(screen.queryByText(/still transcribe locally/)).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.queryByText(/Sample practice|typed answers|sample answers count/)).toBeNull();
  expect(screen.getByRole('timer').textContent).toBe('1:00');
  expect(screen.getByRole('heading', { name: 'Ready when you are.' })).toBeDefined();
  view.unmount();
  await act(async () => {});
});
