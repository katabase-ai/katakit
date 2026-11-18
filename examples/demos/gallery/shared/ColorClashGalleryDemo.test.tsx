// @vitest-environment happy-dom
import { Suspense, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  createMicrophoneTranscriber,
  type MicrophoneOptions,
} from '@katakit/transcription/browser';
import { GallerySpeechProvider } from './GallerySpeechProvider';
import { GalleryModeProvider } from './GalleryModeProvider';
import { GalleryDemo } from './GalleryDemo';
import { colorClashGalleryDemo } from './galleryDemos';

vi.mock('@katakit/transcription/browser', async importOriginal => ({
  ...(await importOriginal<typeof import('@katakit/transcription/browser')>()),
  createMicrophoneTranscriber: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fixture = ({ pendingFirstStart = false } = {}) => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const inputs: {
    callbacks: MicrophoneOptions;
    sourceId?: string;
    tail?: Promise<void>;
    dispose: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }[] = [];
  const microphone = vi.fn();
  vi.mocked(createMicrophoneTranscriber).mockImplementation(callbacks => {
    let disposed = false;
    let finishStart: (() => void) | undefined;
    const input = {
      callbacks,
      sourceId: undefined as string | undefined,
      tail: undefined as Promise<void> | undefined,
      dispose: vi.fn(async () => {
        disposed = true;
        finishStart?.();
      }),
      start: vi.fn(async (options?: { sourceId?: string }) => {
        input.sourceId = options?.sourceId;
        if (pendingFirstStart && inputs.length === 1) {
          callbacks.onState?.({ phase: 'loading' });
          await new Promise<void>(resolve => {
            finishStart = resolve;
          });
          if (disposed) return;
        }
        microphone();
        callbacks.onState?.({ phase: 'running' });
      }),
      stop: vi.fn(async () => {
        await input.tail;
        if (input.sourceId)
          callbacks.onFinal({ id: 'tail', sourceId: input.sourceId, text: 'drained words' });
        callbacks.onStop?.();
        callbacks.onState?.({ phase: 'ready' });
      }),
    };
    inputs.push(input);
    return {
      load: async () => callbacks.onState?.({ phase: 'ready' }),
      start: input.start,
      stop: input.stop,
      dispose: input.dispose,
    };
  });
  const next = {
    ingestSegment: vi.fn(),
    updateProvisional: vi.fn(),
    flush: vi.fn(),
    close: vi.fn(),
  };
  const createNext = vi.fn(() => next);
  const Game = colorClashGalleryDemo.component;
  const Harness = ({ developerMode = false }: { developerMode?: boolean }) => {
    const [game, setGame] = useState(true);
    return (
      <GallerySpeechProvider>
        <GalleryModeProvider developerMode={developerMode}>
          <button type="button" onClick={() => setGame(false)}>
            Next demo
          </button>
          <button type="button" onClick={() => setGame(true)}>
            Open Color Clash
          </button>
          <Suspense fallback={<p>Loading game…</p>}>
            {game ? (
              <Game />
            ) : (
              <GalleryDemo create={createNext} render={() => <p>Next demo ready</p>} />
            )}
          </Suspense>
        </GalleryModeProvider>
      </GallerySpeechProvider>
    );
  };
  return {
    Harness,
    inputs,
    microphone,
    next,
    createNext,
    clock: (time: number) => {
      now = time;
    },
  };
};

test.each([false, true])(
  'Color Clash is playable without inference in developerMode=%s and stops capture at round end',
  async developerMode => {
    const { Harness, inputs, clock } = fixture();
    const view = render(<Harness developerMode={developerMode} />);
    await screen.findByRole('button', { name: 'Play' });
    expect(inputs).toHaveLength(0);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play' })));
    await screen.findByText(/You have 20 seconds/);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.start).toHaveBeenCalledOnce();
    clock(22000);
    await screen.findByRole('heading', { name: 'Time’s up' });
    await vi.waitFor(() => expect(inputs[0]!.stop).toHaveBeenCalledOnce());
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play again' })));
    await screen.findByText(/You have 20 seconds/);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.start).toHaveBeenCalledTimes(2);
    view.unmount();
  }
);

test('leaving an active game clears its clock, drains into the outgoing game and retains the model for a fresh visit', async () => {
  const { Harness, inputs, clock, next, createNext } = fixture();
  const cleared = vi.spyOn(window, 'clearInterval');
  const view = render(<Harness />);
  await screen.findByRole('button', { name: 'Play' });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play' })));
  await screen.findByText(/You have 20 seconds/);
  clock(2000);
  const target = await screen.findByLabelText(/written in/);
  const color = target.getAttribute('data-ink')!;
  act(() => inputs[0]!.callbacks.onProvisional?.(color));
  expect(screen.getByText('1', { selector: '.color-clash-score strong' })).toBeDefined();
  let drained!: () => void;
  inputs[0]!.tail = new Promise(resolve => {
    drained = resolve;
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next demo' }));
  await vi.waitFor(() => expect(inputs[0]!.stop).toHaveBeenCalledOnce());
  expect(createNext).not.toHaveBeenCalled();
  expect(cleared).toHaveBeenCalled();
  await act(async () => drained());
  await screen.findByText('Next demo ready');
  expect(next.ingestSegment).not.toHaveBeenCalled();
  act(() =>
    inputs[0]!.callbacks.onFinal({
      id: 'late',
      sourceId: inputs[0]!.sourceId!,
      text: 'old game words',
    })
  );
  expect(next.ingestSegment).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Open Color Clash' }));
  await screen.findByRole('button', { name: 'Play' });
  expect(screen.getByText('0', { selector: '.color-clash-score strong' })).toBeDefined();
  expect(inputs).toHaveLength(1);
  expect(inputs[0]!.dispose).not.toHaveBeenCalled();
  view.unmount();
});

test('navigation during Play model loading cancels setup before a late microphone grant', async () => {
  const { Harness, inputs, microphone } = fixture({ pendingFirstStart: true });
  const view = render(<Harness />);
  await screen.findByRole('button', { name: 'Play' });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play' })));
  await screen.findByRole('button', { name: 'Cancel setup' });
  fireEvent.click(screen.getByRole('button', { name: 'Next demo' }));
  await screen.findByText('Next demo ready');
  expect(inputs[0]!.dispose).toHaveBeenCalledOnce();
  expect(microphone).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Open Color Clash' }));
  await screen.findByRole('button', { name: 'Play' });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play' })));
  await screen.findByText(/You have 20 seconds/);
  expect(microphone).toHaveBeenCalledOnce();
  expect(inputs).toHaveLength(2);
  view.unmount();
});
