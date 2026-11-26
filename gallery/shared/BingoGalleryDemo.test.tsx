// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { createMicrophoneTranscriber } from '@katakit/transcription/browser';
import { GallerySpeechProvider } from './GallerySpeechProvider';
import { BingoGalleryDemo } from './BingoGalleryDemo';

vi.mock('@katakit/transcription/browser', async importOriginal => ({
  ...(await importOriginal<typeof import('@katakit/transcription/browser')>()),
  createMicrophoneTranscriber: vi.fn(),
}));
afterEach(cleanup);

test('gallery capture feeds the selected Bingo pack and a new visit starts unmarked', async () => {
  let sourceId: string | undefined;
  let finalText = '';
  vi.mocked(createMicrophoneTranscriber).mockImplementation(options => ({
    load: async () => {},
    start: async input => {
      sourceId = input?.sourceId;
      options.onState?.({ phase: 'running' });
    },
    stop: async () => {
      if (!sourceId) return;
      options.onFinal({ id: 'last', sourceId, text: finalText });
      options.onStop?.();
      options.onState?.({ phase: 'ready' });
      sourceId = undefined;
    },
    dispose: async () => {},
  }));
  const view = render(
    <GallerySpeechProvider>
      <BingoGalleryDemo />
    </GallerySpeechProvider>
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Start listening' }));
  await screen.findByRole('button', { name: 'Pause listening' });
  fireEvent.change(screen.getByLabelText('Word list'), { target: { value: 'animals' } });
  const card = within(screen.getByRole('group', { name: 'Click squares to mark or correct them' }));
  const square = card.getAllByRole('button')[0]!;
  finalText = square.textContent!;
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Pause listening' }));
  });
  expect(square.getAttribute('aria-pressed')).toBe('true');
  expect(createMicrophoneTranscriber).toHaveBeenCalledTimes(1);
  view.rerender(<GallerySpeechProvider>{null}</GallerySpeechProvider>);
  view.rerender(
    <GallerySpeechProvider>
      <BingoGalleryDemo />
    </GallerySpeechProvider>
  );
  await screen.findByText('0 of 25 squares');
});
