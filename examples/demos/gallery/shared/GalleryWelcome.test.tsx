// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { TranscriptionError, type TranscriptionErrorCode } from '@katakit/transcription';
import {
  createMicrophoneTranscriber,
  type MicrophoneOptions,
} from '@katakit/transcription/browser';
import { createTranscriptionDemo } from '../../transcription-react/src/createTranscriptionDemo';
import { GallerySpeechProvider, useGallerySpeech } from './GallerySpeechProvider';
import { GalleryCaptureControls } from './GalleryCaptureControls';
import { GalleryDemo } from './GalleryDemo';
import { GalleryWelcome } from './GalleryWelcome';

vi.mock('@katakit/transcription/browser', async importOriginal => ({
  ...(await importOriginal<typeof import('@katakit/transcription/browser')>()),
  createMicrophoneTranscriber: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fixture = ({ pending }: { pending?: 'loading' | 'starting' } = {}) => {
  let failure: TranscriptionError | undefined;
  let finishStart: (() => void) | undefined;
  const inputs: {
    callbacks: MicrophoneOptions;
    sourceId?: string;
    start: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }[] = [];
  vi.mocked(createMicrophoneTranscriber).mockImplementation(callbacks => {
    let disposed = false;
    const input = {
      callbacks,
      sourceId: undefined as string | undefined,
      start: vi.fn(async (options?: { sourceId?: string }) => {
        input.sourceId = options?.sourceId;
        if (pending) {
          callbacks.onState?.({ phase: pending, progress: 0.5 });
          await new Promise<void>(resolve => {
            finishStart = resolve;
          });
          if (disposed) return;
        }
        if (failure) {
          callbacks.onState?.({ phase: 'error', error: failure });
          throw failure;
        }
        callbacks.onState?.({ phase: 'running' });
      }),
      dispose: vi.fn(async () => {
        disposed = true;
        finishStart?.();
      }),
    };
    inputs.push(input);
    return {
      load: async () => callbacks.onState?.({ phase: 'ready' }),
      start: input.start,
      stop: async () => {
        callbacks.onStop?.();
        callbacks.onState?.({ phase: 'ready' });
      },
      dispose: input.dispose,
    };
  });
  return {
    inputs,
    fail: (code?: TranscriptionErrorCode) => {
      failure = code ? new TranscriptionError(code, 'Original failure') : undefined;
    },
  };
};

const SpeechActions = () => {
  const session = useGallerySpeech();
  return (
    <>
      <button onClick={() => void session?.owner.load()}>Preload model</button>
      <button onClick={() => void session?.owner.select('whisper-tiny')}>Change model</button>
    </>
  );
};

const Harness = ({ initialWelcome = true }: { initialWelcome?: boolean }) => {
  const [welcome, setWelcome] = useState(initialWelcome);
  return (
    <GallerySpeechProvider>
      <SpeechActions />
      <button onClick={() => setWelcome(current => !current)}>Navigate</button>
      {welcome ? (
        <GalleryWelcome privacyUrl="https://katabase.com/privacy" />
      ) : (
        <GalleryDemo create={createTranscriptionDemo} render={() => <GalleryCaptureControls />} />
      )}
    </GallerySpeechProvider>
  );
};

const click = async (name: string) => {
  const button = await screen.findByRole('button', { name });
  await vi.waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
  await act(async () => fireEvent.click(button));
};

test('a model download alone leaves Welcome untested and preserves the privacy link', async () => {
  const { inputs } = fixture();
  render(<Harness />);
  await screen.findByRole('button', { name: 'Set up microphone' });
  expect(inputs).toHaveLength(0);
  expect(screen.getByRole('log', { name: 'Test transcript' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Set up your mic' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Microphone setup: Not set up' })).toBeDefined();
  await click('Preload model');
  expect(inputs[0]!.start).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Microphone setup: Ready' })).toBeNull();
  expect(screen.getByRole('link', { name: 'katabase.com/privacy' }).getAttribute('href')).toBe(
    'https://katabase.com/privacy'
  );
});

test('the transcript remains visible before, during, and after a successful test', async () => {
  const { inputs } = fixture();
  render(<Harness />);
  await click('Set up microphone');
  await screen.findByRole('img', { name: 'Microphone listening' });
  expect(screen.getByRole('heading', { name: 'Set up your mic' })).toBeDefined();
  expect(screen.getByRole('img', { name: 'Microphone listening' })).toBeDefined();
  act(() => inputs[0]!.callbacks.onProvisional?.('Hello microphone'));
  expect(screen.getByLabelText('Test transcript').textContent).toContain('Hello microphone');
  act(() =>
    inputs[0]!.callbacks.onFinal({
      id: 'test',
      sourceId: inputs[0]!.sourceId!,
      text: 'Hello microphone',
    })
  );
  await click('Stop listening');
  expect(screen.getByRole('button', { name: 'Microphone setup: Ready' })).toBeDefined();
  expect(screen.getByRole('img', { name: 'Microphone off' })).toBeDefined();
  expect(screen.getByRole('log', { name: 'Test transcript' }).textContent).toContain(
    'Hello microphone'
  );
  expect(screen.queryByRole('img', { name: 'Microphone listening' })).toBeNull();
  expect(inputs[0]!.start).toHaveBeenCalledOnce();
  await click('Test again');
  expect(inputs[0]!.start).toHaveBeenCalledTimes(2);
});

test('Welcome remembers a successful start in another demo without restarting capture', async () => {
  const { inputs } = fixture();
  render(<Harness initialWelcome={false} />);
  await click('Start listening');
  await click('Navigate');
  await screen.findByRole('button', { name: 'Test again' });
  expect(screen.getByRole('button', { name: 'Microphone setup: Ready' })).toBeDefined();
  expect(screen.queryByRole('img', { name: 'Microphone listening' })).toBeNull();
  expect(inputs[0]!.start).toHaveBeenCalledOnce();
  await click('Change model');
  expect(screen.getByRole('heading', { name: 'Set up your mic' })).toBeDefined();
});

test('a denied retest replaces success with Color Clash permission guidance and recovers on retry', async () => {
  const { inputs, fail } = fixture();
  render(<Harness />);
  await click('Set up microphone');
  await click('Stop listening');
  fail('microphone-permission-denied');
  await click('Test again');
  await screen.findByRole('button', { name: 'Microphone setup: Needs attention' });
  expect(screen.getByRole('heading', { name: 'Set up your mic' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Microphone setup: Ready' })).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('allow Microphone in site settings');
  expect(screen.getByRole('alert').textContent).not.toContain('Original failure');
  const help = screen.getByText('How to enable your microphone').closest('details')!;
  expect(help.open).toBe(false);
  expect(help.textContent).toContain('Set Microphone to Allow, or reset the blocked permission.');
  expect(help.textContent).toContain("computer's privacy settings");
  fail();
  await click('Try microphone again');
  await screen.findByRole('img', { name: 'Microphone listening' });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(inputs[0]!.start).toHaveBeenCalledTimes(3);
});

test.each([
  ['microphone-unavailable', 'Connect a microphone'],
  ['model-load-failed', 'speech model could not load'],
] as const)(
  'provides relevant recovery for %s without permission instructions',
  async (code, message) => {
    const { fail } = fixture();
    fail(code);
    render(<Harness />);
    await click('Set up microphone');
    expect(screen.getByRole('heading', { name: 'Set up your mic' })).toBeDefined();
    expect(screen.getByRole('alert').textContent).toContain(message);
    expect(screen.queryByText('How to enable your microphone')).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  }
);

test.each(['loading', 'starting'] as const)(
  'cancelling %s does not mark setup successful or start the microphone later',
  async pending => {
    const { inputs } = fixture({ pending });
    render(<Harness />);
    await click('Set up microphone');
    expect(
      screen.getByText(
        pending === 'loading'
          ? 'Downloading speech model… 50%'
          : 'Allow microphone access in your browser to finish setup.'
      )
    ).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Set up your mic' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Microphone setup: Setting up' })).toBeDefined();
    expect(
      screen.queryByRole('progressbar', { name: 'Speech model download' })?.getAttribute('value')
    ).toBe(pending === 'loading' ? '0.5' : undefined);
    await click(pending === 'loading' ? 'Cancel download' : 'Cancel');
    await screen.findByRole('button', { name: 'Set up microphone' });
    expect(inputs[0]!.dispose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Microphone setup: Ready' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Microphone listening' })).toBeNull();
  }
);

test('an unrecoverable owner error offers reload instead of a disabled retry or stuck preparation', async () => {
  const { inputs } = fixture();
  render(<Harness />);
  await click('Set up microphone');
  await click('Stop listening');
  inputs[0]!.dispose.mockRejectedValueOnce(new Error('Could not release speech resources.'));
  await click('Change model');
  expect(screen.getByRole('alert').textContent).toContain('Reload this page before trying again.');
  expect(screen.getByRole('button', { name: 'Reload page' }).hasAttribute('disabled')).toBe(false);
  expect(screen.queryByText('Preparing demo…')).toBeNull();
  expect(screen.getByRole('log', { name: 'Test transcript' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
});

test('Welcome places the agreed copy under its headings and confines markers to the explanation', async () => {
  fixture();
  render(<Harness />);
  await screen.findByRole('button', { name: 'Set up microphone' });
  const welcomeHeading = screen.getByRole('heading', { name: 'Welcome!' });
  expect(welcomeHeading.nextElementSibling?.textContent).toContain('voice-to-visual interfaces');
  const microphoneHeading = screen.getByRole('heading', { name: 'Set up your mic' });
  expect(microphoneHeading.parentElement?.nextElementSibling?.textContent).toContain(
    'Your audio data always stays on your device.'
  );
  const cloudHeading = screen.getByRole('heading', { name: 'Cloud-based models' });
  expect(cloudHeading.nextElementSibling?.textContent).toContain(
    'reason about the conversation as it unfolds'
  );
  const legend = screen.getByLabelText('Demo data handling');
  expect(within(legend).getByRole('img', { name: 'On-device' })).toBeDefined();
  expect(within(legend).getByRole('img', { name: 'Cloud processing' })).toBeDefined();
  expect(screen.getAllByRole('img', { name: /On-device|Cloud processing/ })).toHaveLength(2);
  expect(screen.queryByText(/Say a few words/)).toBeNull();
});

test('readiness text opens on focus and pointer hover and dismisses with Escape', async () => {
  const { inputs } = fixture();
  render(<Harness />);
  const readiness = await screen.findByRole('button', { name: 'Microphone setup: Not set up' });
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.focus(readiness);
  expect(screen.getByRole('tooltip').textContent).toBe('Not set up');
  fireEvent.keyDown(readiness, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.blur(readiness);
  fireEvent.pointerEnter(readiness.parentElement!, { pointerType: 'mouse' });
  expect(screen.getByRole('tooltip').textContent).toBe('Not set up');
  fireEvent.pointerLeave(readiness.parentElement!, { pointerType: 'mouse' });
  expect(screen.queryByRole('tooltip')).toBeNull();
  expect(inputs).toHaveLength(0);
});

test('the passive mic follows real level callbacks while only the adjacent button starts capture', async () => {
  const { inputs } = fixture();
  render(<Harness />);
  const off = await screen.findByRole('img', { name: 'Microphone off' });
  fireEvent.click(off);
  expect(inputs).toHaveLength(0);
  await click('Set up microphone');
  const listening = screen.getByRole('img', { name: 'Microphone listening' });
  expect(listening.tagName).toBe('DIV');
  act(() => inputs[0]!.callbacks.onLevel?.(0.04));
  expect(Number(listening.style.getPropertyValue('--gallery-microphone-response'))).toBeGreaterThan(
    0.04
  );
  act(() => inputs[0]!.callbacks.onLevel?.(0.76));
  expect(listening.style.getPropertyValue('--gallery-microphone-level')).toBe('0.76');
  expect(listening.parentElement?.querySelector('.site-audio-level')).toBeNull();
  await click('Stop listening');
  expect(
    screen
      .getByRole('img', { name: 'Microphone off' })
      .style.getPropertyValue('--gallery-microphone-level')
  ).toBe('0');
  expect(
    screen
      .getByRole('img', { name: 'Microphone off' })
      .style.getPropertyValue('--gallery-microphone-response')
  ).toBe('0');
  expect(screen.getByRole('button', { name: 'Microphone setup: Ready' })).toBeDefined();
});

test('setup remains in progress across the model-ready handoff until permission completes', async () => {
  const { inputs } = fixture({ pending: 'loading' });
  render(<Harness />);
  await click('Set up microphone');
  act(() => inputs[0]!.callbacks.onState?.({ phase: 'ready' }));
  expect(screen.getByRole('button', { name: 'Microphone setup: Setting up' })).toBeDefined();
  expect(screen.queryByRole('progressbar')).toBeNull();
  act(() => inputs[0]!.callbacks.onState?.({ phase: 'starting' }));
  expect(screen.getByRole('button', { name: 'Microphone setup: Setting up' })).toBeDefined();
  expect(
    screen.getByText('Allow microphone access in your browser to finish setup.')
  ).toBeDefined();
  await click('Cancel');
  expect(screen.getByRole('button', { name: 'Microphone setup: Not set up' })).toBeDefined();
});
