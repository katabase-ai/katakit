// @vitest-environment happy-dom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { GallerySpeechProvider } from './GallerySpeechProvider';
import { GalleryDemo } from './GalleryDemo';

afterEach(cleanup);

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
        <GalleryDemo
          key={key}
          create={create}
          render={(_, controls) => (
            <>
              <p>Demo ready</p>
              {controls}
            </>
          )}
        />
      </GallerySpeechProvider>
    </StrictMode>
  );
  const view = render(content('first'));
  await screen.findByText('Demo ready');
  fireEvent.change(screen.getByLabelText('Transcription model'), {
    target: { value: 'whisper-tiny' },
  });
  await act(async () => {
    await Promise.resolve();
  });
  expect((screen.getByLabelText('Transcription model') as HTMLSelectElement).value).toBe(
    'whisper-tiny'
  );
  view.rerender(content('second'));
  await screen.findByText('Demo ready');
  expect((screen.getByLabelText('Transcription model') as HTMLSelectElement).value).toBe(
    'whisper-tiny'
  );
  view.unmount();
  await vi.waitFor(() => {
    for (const runtime of created) expect(runtime.close).toHaveBeenCalledOnce();
  });
  expect(created.length).toBeGreaterThanOrEqual(2);
});
