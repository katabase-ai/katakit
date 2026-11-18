// @vitest-environment happy-dom
import { Suspense } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { TranscriptionError } from '@katakit/transcription';
import {
  createMicrophoneTranscriber,
  type MicrophoneOptions,
} from '@katakit/transcription/browser';
import { galleryDemos } from './galleryDemos';
import { GallerySpeechProvider } from './GallerySpeechProvider';

vi.mock('@katakit/transcription/browser', async importOriginal => ({
  ...(await importOriginal<typeof import('@katakit/transcription/browser')>()),
  createMicrophoneTranscriber: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fixture = (initial: 'loading' | 'starting' | 'denied') => {
  let stage: typeof initial | 'running' = initial;
  let finishStart: (() => void) | undefined;
  const microphone = vi.fn();
  const inputs: { callbacks: MicrophoneOptions; dispose: ReturnType<typeof vi.fn> }[] = [];
  vi.mocked(createMicrophoneTranscriber).mockImplementation(callbacks => {
    let disposed = false;
    const dispose = vi.fn(async () => {
      disposed = true;
      finishStart?.();
    });
    inputs.push({ callbacks, dispose });
    return {
      load: async () => callbacks.onState?.({ phase: 'ready' }),
      start: async () => {
        if (stage === 'loading' || stage === 'starting') {
          callbacks.onState?.({ phase: stage, progress: 0.25 });
          await new Promise<void>(resolve => {
            finishStart = resolve;
          });
          if (disposed) return;
        }
        if (stage === 'denied') {
          const error = new TranscriptionError(
            'microphone-permission-denied',
            'Raw browser failure'
          );
          callbacks.onState?.({ phase: 'error', error });
          throw error;
        }
        microphone();
        callbacks.onState?.({ phase: 'running' });
      },
      stop: async () => {
        callbacks.onStop?.();
        callbacks.onState?.({ phase: 'ready' });
      },
      dispose,
    };
  });
  return {
    inputs,
    microphone,
    recover: () => {
      stage = 'running';
    },
    finishStart: () => finishStart?.(),
  };
};

const click = async (name: string) => {
  const button = await screen.findByRole('button', { name });
  await vi.waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  await act(async () => fireEvent.click(button));
};
const mountDemo = (demo: (typeof galleryDemos)[number]) => {
  const Demo = demo.component;
  return render(
    <GallerySpeechProvider>
      <Suspense fallback={null}>
        <Demo />
      </Suspense>
    </GallerySpeechProvider>
  );
};

test.each(galleryDemos)(
  '$title explains permission recovery and retries only after an explicit action',
  async demo => {
    const f = fixture('denied');
    mountDemo(demo);
    await click(demo.id === 'color-clash' ? 'Play' : 'Start listening');
    expect((await screen.findByRole('alert')).textContent).toContain(
      'allow Microphone in site settings'
    );
    expect(screen.getByRole('alert').textContent).not.toContain('Raw browser failure');
    expect(screen.getByText('How to enable your microphone').closest('details')?.open).toBe(false);
    expect(f.microphone).not.toHaveBeenCalled();
    f.recover();
    await act(async () => {
      await Promise.resolve();
    });
    expect(f.microphone).not.toHaveBeenCalled();
    await click('Try microphone again');
    expect(f.microphone).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).toBeNull();
  }
);

for (const phase of ['loading', 'starting'] as const) {
  test.each(galleryDemos)(
    `$title cancels ${phase} before capture and permits a fresh explicit start`,
    async demo => {
      const f = fixture(phase);
      mountDemo(demo);
      const start = demo.id === 'color-clash' ? 'Play' : 'Start listening';
      await click(start);
      await click(phase === 'loading' ? 'Cancel download' : 'Cancel setup');
      expect(f.inputs[0]!.dispose).toHaveBeenCalledOnce();
      await act(async () => f.finishStart());
      expect(f.microphone).not.toHaveBeenCalled();
      f.recover();
      await click(start);
      expect(f.microphone).toHaveBeenCalledOnce();
      expect(f.inputs).toHaveLength(2);
    }
  );
}

test('a failed cancellation offers an enabled reload instead of a disabled retry with stale permission help', async () => {
  const f = fixture('loading');
  mountDemo(galleryDemos[0]!);
  await click('Start listening');
  f.inputs[0]!.dispose.mockImplementation(async () => {
    f.finishStart();
    throw new Error('Capture cleanup failed');
  });
  await click('Cancel download');
  const reload = await screen.findByRole('button', { name: 'Reload page' });
  expect((reload as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByRole('alert').textContent).toContain('Capture cleanup failed');
  expect(screen.getByRole('alert').textContent).toContain('Reload this page');
  expect(screen.queryByText('How to enable your microphone')).toBeNull();
});

test('a stopping input cannot be restarted while its stop has not settled', async () => {
  const f = fixture('denied');
  f.recover();
  mountDemo(galleryDemos[0]!);
  await click('Start listening');
  await act(async () => f.inputs[0]!.callbacks.onState?.({ phase: 'stopping' }));
  const button = screen.getByRole('button', { name: 'Stopping…' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(f.microphone).toHaveBeenCalledOnce();
});
