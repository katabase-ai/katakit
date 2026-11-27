// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { TranscriptionError, type TranscriptionErrorCode } from '@katakit/transcription';
import {
  createMicrophoneTranscriber,
  type MicrophoneOptions,
} from '@katakit/transcription/browser';
import { createTranscriptionDemo } from '../../examples/demos/transcription/src/createTranscriptionDemo';
import { GallerySpeechProvider, useGallerySpeech } from './GallerySpeechProvider';
import { GalleryCaptureControls } from './GalleryCaptureControls';
import { GalleryConsentProvider } from './GalleryConsentProvider';
import { GalleryDemo } from './GalleryDemo';
import { Gallery } from './Gallery';
import { transcriptionDemoDetails } from './galleryDemoDetails';
import { GallerySpeechControls } from './GallerySpeechControls';

vi.mock('@katakit/transcription/browser', async importOriginal => ({
  ...(await importOriginal<typeof import('@katakit/transcription/browser')>()),
  createMicrophoneTranscriber: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
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
    finishStart: () => finishStart?.(),
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

const Harness = ({
  initialWelcome = true,
  showFooter = false,
}: {
  initialWelcome?: boolean;
  showFooter?: boolean;
}) => {
  const [welcome, setWelcome] = useState(initialWelcome);
  return (
    <GalleryConsentProvider>
      <GallerySpeechProvider>
        <SpeechActions />
        {showFooter && <GallerySpeechControls />}
        <button onClick={() => setWelcome(current => !current)}>Navigate</button>
        {welcome ? (
          <Gallery
            demos={[]}
            renderLink={({ children }) => <a href="/">{children}</a>}
            privacyUrl="https://katabase.com/privacy"
            termsUrl="https://example.com/terms"
          />
        ) : (
          <GalleryDemo create={createTranscriptionDemo} render={() => <GalleryCaptureControls />} />
        )}
      </GallerySpeechProvider>
    </GalleryConsentProvider>
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
  await click('Preload model');
  expect(screen.getByText('Transcription model successfully downloaded')).toBeDefined();
  expect(inputs[0]!.start).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe(
    'https://katabase.com/privacy'
  );
  const terms = within(screen.getByRole('region', { name: 'How cloud servers work' })).getByRole(
    'link',
    { name: 'Terms of Service' }
  );
  expect(terms.getAttribute('href')).toBe('https://example.com/terms');
  expect(terms.getAttribute('target')).toBe('_blank');
  expect(terms.getAttribute('rel')).toBe('noopener noreferrer');
});

test('Welcome shows consent for setup once per visit and keeps it hidden when retesting', async () => {
  fixture();
  render(<Harness />);
  await screen.findByRole('button', { name: 'Set up microphone' });
  const setup = within(screen.getByRole('region', { name: 'Set up your mic' }));
  expect(setup.getByRole('link', { name: 'Terms of Service' }).getAttribute('href')).toBe(
    'https://example.com/terms'
  );
  await click('Set up microphone');
  expect(setup.getByRole('button', { name: 'Stop listening' })).toBeDefined();
  expect(setup.queryByRole('link', { name: 'Terms of Service' })).toBeNull();
  await click('Stop listening');
  expect(setup.getByRole('button', { name: 'Test again' })).toBeDefined();
  expect(setup.queryByRole('link', { name: 'Terms of Service' })).toBeNull();
});

test('failed microphone setup still remembers the primary consent click', async () => {
  const { fail } = fixture();
  fail('microphone-permission-denied');
  render(<Harness />);
  await click('Set up microphone');
  const setup = within(screen.getByRole('region', { name: 'Set up your mic' }));
  expect(setup.getByRole('button', { name: 'Try microphone again' })).toBeDefined();
  expect(setup.queryByRole('link', { name: 'Terms of Service' })).toBeNull();
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
  expect(screen.getByText('Transcription model successfully downloaded')).toBeDefined();
  expect(screen.getByRole('img', { name: 'Microphone off' })).toBeDefined();
  expect(screen.getByRole('log', { name: 'Test transcript' }).textContent).toContain(
    'Hello microphone'
  );
  expect(screen.queryByRole('img', { name: 'Microphone listening' })).toBeNull();
  expect(inputs[0]!.start).toHaveBeenCalledOnce();
  await click('Test again');
  expect(inputs[0]!.start).toHaveBeenCalledTimes(2);
});

test('a verified retest keeps the download confirmation without flashing setup instructions', async () => {
  const { finishStart } = fixture({ pending: 'starting' });
  render(<Harness />);
  await click('Set up microphone');
  expect(
    screen.getByText('Allow microphone access in your browser to finish setup.')
  ).toBeDefined();
  await act(async () => finishStart());
  await screen.findByRole('img', { name: 'Microphone listening' });
  await click('Stop listening');
  await click('Test again');
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
  expect(screen.getByText('Transcription model successfully downloaded')).toBeDefined();
  expect(screen.queryByText('Allow microphone access in your browser to finish setup.')).toBeNull();
  expect(screen.queryByText('Preparing microphone…')).toBeNull();
  await click('Cancel');
});

test('Welcome remembers a successful start in another demo without restarting capture', async () => {
  const { inputs } = fixture();
  render(<Harness initialWelcome={false} />);
  await click('Start listening');
  await click('Navigate');
  await screen.findByRole('button', { name: 'Test again' });
  expect(screen.getByText('Transcription model successfully downloaded')).toBeDefined();
  expect(screen.queryByRole('img', { name: 'Microphone listening' })).toBeNull();
  expect(inputs[0]!.start).toHaveBeenCalledOnce();
  await click('Change model');
  expect(screen.queryByText('Transcription model successfully downloaded')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Set up your mic' })).toBeDefined();
});

test('a denied retest replaces success with Color Clash permission guidance and recovers on retry', async () => {
  const { inputs, fail } = fixture();
  render(<Harness />);
  await click('Set up microphone');
  await click('Stop listening');
  fail('microphone-permission-denied');
  await click('Test again');
  await screen.findByRole('button', { name: 'Try microphone again' });
  expect(screen.getByRole('heading', { name: 'Set up your mic' })).toBeDefined();
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
    expect(screen.getByRole('alert').closest('.gallery-welcome-capture-feedback')).not.toBeNull();
    expect(screen.queryByText('Transcription model successfully downloaded')).toBeNull();
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
    expect(document.querySelector('.gallery-demo-frame')?.getAttribute('data-loading')).toBe(
      'false'
    );
    expect(document.querySelector('.gallery-demo-stage')?.hasAttribute('hidden')).toBe(false);
    expect(screen.queryByText('Opening…')).toBeNull();
    expect(
      screen.queryByRole('progressbar', { name: 'Speech model download' })?.getAttribute('value')
    ).toBe(pending === 'loading' ? '0.5' : undefined);
    expect(screen.queryByText('Transcription model successfully downloaded') !== null).toBe(
      pending === 'starting'
    );
    await click(pending === 'loading' ? 'Cancel download' : 'Cancel');
    await screen.findByRole('button', { name: 'Set up microphone' });
    expect(inputs[0]!.dispose).toHaveBeenCalledOnce();
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
  const cloudHeading = screen.getByRole('heading', { name: 'How cloud servers work' });
  expect(cloudHeading.nextElementSibling?.textContent).toContain(
    'reason about the conversation as it unfolds'
  );
  const legend = screen.getByLabelText('Demo data handling');
  expect(within(legend).getByText('On-device')).toBeDefined();
  expect(within(legend).getByText('Cloud-assisted')).toBeDefined();
  expect(screen.getAllByText(/^(On-device|Cloud-assisted)$/)).toHaveLength(2);
  expect(screen.queryByText(/Say a few words/)).toBeNull();
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
});

test('setup remains in progress across the model-ready handoff until permission completes', async () => {
  const { inputs } = fixture({ pending: 'loading' });
  render(<Harness />);
  await click('Set up microphone');
  act(() => inputs[0]!.callbacks.onState?.({ phase: 'ready' }));
  const confirmation = screen.getByText('Transcription model successfully downloaded');
  const feedback = confirmation.closest<HTMLDivElement>('.gallery-welcome-capture-feedback')!;
  expect(screen.queryByRole('progressbar')).toBeNull();
  act(() => inputs[0]!.callbacks.onState?.({ phase: 'starting' }));
  expect(feedback.parentElement).toBe(screen.getByRole('button', { name: 'Cancel' }).parentElement);
  expect(
    within(feedback).getByText('Allow microphone access in your browser to finish setup.')
  ).toBeDefined();
  expect(within(feedback).getByText('Transcription model successfully downloaded')).toBeDefined();
  await click('Cancel');
});

test('Welcome shows every setup state and the level; the footer has no microphone status or capture actions', async () => {
  const { inputs, finishStart, fail } = fixture({ pending: 'loading' });
  render(<Harness showFooter />);
  const footer = within(screen.getByRole('region', { name: 'Operation status' }));
  const page = within(screen.getByRole('region', { name: 'Set up your mic' }));
  expect(footer.queryByRole('img', { name: /Microphone/ })).toBeNull();
  expect(inputs).toHaveLength(0);
  expect(footer.queryByRole('button', { name: /Download|Cancel|Start|Stop|Test/ })).toBeNull();
  expect(footer.queryByText('Usage unavailable')).toBeNull();
  await click('Set up microphone');
  act(() => inputs[0]!.callbacks.onState?.({ phase: 'ready' }));
  await act(async () => finishStart());
  act(() => inputs[0]!.callbacks.onLevel?.(0.64));
  const pageMic = page.getByRole('img', { name: 'Microphone listening' });
  expect(pageMic.style.getPropertyValue('--gallery-microphone-level')).toBe('0.64');
  expect(pageMic.style.getPropertyValue('--gallery-microphone-response')).toBe('0.8');
  expect(footer.queryByRole('img', { name: /Microphone/ })).toBeNull();
  await click('Stop listening');
  expect(
    page
      .getByRole('img', { name: 'Microphone off' })
      .style.getPropertyValue('--gallery-microphone-response')
  ).toBe('0');
  fail('microphone-permission-denied');
  await click('Test again');
  await act(async () => finishStart());
});

test('Welcome retains readiness from another demo across navigation while capture stops', async () => {
  const { inputs } = fixture();
  render(<Harness initialWelcome={false} showFooter />);
  await click('Preload model');
  await click('Start listening');
  await click('Navigate');
  await screen.findByRole('button', { name: 'Test again' });
  expect(screen.getByRole('img', { name: 'Microphone off' })).toBeDefined();
  expect(inputs[0]!.start).toHaveBeenCalledOnce();
  await click('Navigate');
  await click('Start listening');
  expect(inputs[0]!.start).toHaveBeenCalledTimes(2);
});

test('a demo offers Start in its header, then a Pause beside a microphone that fills with the level', async () => {
  const { inputs } = fixture();
  render(
    <GallerySpeechProvider>
      <Gallery
        demos={[transcriptionDemoDetails]}
        activeDemo={transcriptionDemoDetails}
        renderLink={({ children }) => <a href="/">{children}</a>}
        termsUrl="/terms"
      >
        <GalleryDemo create={createTranscriptionDemo} render={() => <GalleryCaptureControls />} />
      </Gallery>
    </GallerySpeechProvider>
  );
  const header = within(screen.getByRole('banner'));
  const start = await header.findByRole('button', { name: 'Start listening' });
  expect(start.textContent).toBe('Start');
  expect(start.className).toContain('site-button--blue');
  expect(header.getByRole('link', { name: 'Terms of Service' }).getAttribute('href')).toBe(
    '/terms'
  );
  await click('Start listening');
  const pause = await header.findByRole('button', { name: 'Pause listening' });
  expect(pause.textContent).toBe('Pause');
  expect(pause.className).toContain('site-button--slate');
  expect(header.queryByRole('link', { name: 'Terms of Service' })).toBeNull();
  act(() => inputs[0]!.callbacks.onLevel?.(0.64));
  const fill = () =>
    Number(
      header
        .getByRole('img', { name: 'Microphone listening' })
        .style.getPropertyValue('--gallery-microphone-level')
    );
  expect(fill()).toBe(0.64);
  // A drop to silence falls part of the way, not straight to empty.
  act(() => inputs[0]!.callbacks.onLevel?.(0));
  expect(fill()).toBeCloseTo(0.448);
  await click('Pause listening');
  expect((await header.findByRole('button', { name: 'Start listening' })).textContent).toBe(
    'Start'
  );
});
