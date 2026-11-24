// @vitest-environment happy-dom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { GallerySpeechProvider, useGallerySpeech } from './GallerySpeechProvider';
import { GalleryDemo } from './GalleryDemo';
import { GallerySpeechControls } from './GallerySpeechControls';

afterEach(cleanup);

const ModelProbe = () => {
  const session = useGallerySpeech();
  return (
    <button onClick={() => void session?.owner.select('whisper-tiny')}>
      {session?.snapshot.model}
    </button>
  );
};

test('Strict Mode and repeated navigation release every created demo while keeping model selection in the host', async () => {
  const created: { close: ReturnType<typeof vi.fn> }[] = [];
  const create = () => {
    const runtime = {
      ingestSegment: vi.fn(),
      updateProvisional: vi.fn(),
      flush: vi.fn(),
      close: vi.fn(),
    };
    created.push(runtime);
    return runtime;
  };
  const content = (key: string) => (
    <StrictMode>
      <GallerySpeechProvider>
        <GallerySpeechControls />
        <ModelProbe />
        <GalleryDemo
          key={key}
          create={create}
          render={() => (
            <>
              <p>Demo ready</p>
            </>
          )}
        />
      </GallerySpeechProvider>
    </StrictMode>
  );
  const view = render(content('first'));
  await screen.findByText('Demo ready');
  expect(screen.queryByRole('button', { name: 'Start listening' })).toBeNull();
  expect(screen.queryByLabelText('Transcription model')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'moonshine-small' }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByRole('button', { name: 'whisper-tiny' })).toBeDefined();
  view.rerender(content('second'));
  await screen.findByText('Demo ready');
  expect(screen.getByRole('button', { name: 'whisper-tiny' })).toBeDefined();
  view.unmount();
  await vi.waitFor(() => {
    for (const runtime of created) expect(runtime.close).toHaveBeenCalledOnce();
  });
  expect(created.length).toBeGreaterThanOrEqual(2);
});
