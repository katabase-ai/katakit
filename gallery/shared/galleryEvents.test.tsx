// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { GalleryDemoFrame, useGalleryDemoReady } from './GalleryDemoFrame';
import { GallerySpeechProvider } from './GallerySpeechProvider';
import { useGalleryEvents, type GalleryEvent } from './galleryEvents';
import { useEffect } from 'react';

afterEach(cleanup);

const Demo = () => {
  useGalleryDemoReady(true);
  const { setActiveDemo } = useGalleryEvents();
  useEffect(() => setActiveDemo('bingo'), [setActiveDemo]);
  return (
    <>
      <button>Private square label</button>
      <select aria-label="Word list">
        <option>Private option</option>
      </select>
      <p>Plain text</p>
      <div className="gallery-capture-controls">
        <button>Start listening</button>
      </div>
    </>
  );
};

test('reports the kind of demo control clicked, with the active demo and no label text', () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    }
  );
  const reported: GalleryEvent[] = [];
  render(
    <GallerySpeechProvider
      onEvent={event => {
        reported.push(event);
        // A failing host handler must not reach the visitor.
        throw new Error('host measurement failed');
      }}
    >
      <GalleryDemoFrame demo={{ id: 'bingo', title: 'Conversation bingo' }}>
        <Demo />
      </GalleryDemoFrame>
    </GallerySpeechProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Private square label' }));
  fireEvent.click(screen.getByRole('combobox', { name: 'Word list' }));
  fireEvent.click(screen.getByText('Plain text'));
  fireEvent.click(screen.getByRole('button', { name: 'Start listening' }));
  expect(reported).toEqual([
    { type: 'demoInteracted', element: 'button', demoId: 'bingo' },
    { type: 'demoInteracted', element: 'select', demoId: 'bingo' },
  ]);
  vi.unstubAllGlobals();
});
