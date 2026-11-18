// @vitest-environment happy-dom
import { lazy, StrictMode, type ComponentType } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { createMicrophoneTranscriber } from '@katakit/transcription/browser';
import { GalleryDemo } from './GalleryDemo';
import { GalleryDemoFrame } from './GalleryDemoFrame';
import { GallerySpeechProvider, useGallerySpeech } from './GallerySpeechProvider';

vi.mock('@katakit/transcription/browser', async importOriginal => ({
  ...(await importOriginal<typeof import('@katakit/transcription/browser')>()),
  createMicrophoneTranscriber: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const deferred = <T,>() => {
  let complete!: (value: T) => void;
  const promise = new Promise<T>(resolve => {
    complete = resolve;
  });
  return { promise, resolve: complete };
};

const fixture = () => {
  let height = 640;
  const observers: Observer[] = [];
  class Observer {
    constructor(readonly callback: ResizeObserverCallback) {
      observers.push(this);
    }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    resize() {
      this.callback([], this as unknown as ResizeObserver);
    }
  }
  vi.stubGlobal('ResizeObserver', Observer);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return new DOMRect(0, 0, 800, this.classList.contains('gallery-demo-stage') ? height : 0);
    }
  );
  const events: string[] = [];
  const drain = deferred<void>();
  vi.mocked(createMicrophoneTranscriber).mockImplementation(callbacks => ({
    load: async () => callbacks.onState?.({ phase: 'ready' }),
    start: async () => callbacks.onState?.({ phase: 'running' }),
    stop: async () => {
      events.push('stop');
      await drain.promise;
      callbacks.onStop?.();
      callbacks.onState?.({ phase: 'ready' });
    },
    dispose: async () => {},
  }));
  const sink = (name: string) => {
    events.push(`create:${name}`);
    return {
      ingestSegment: vi.fn(),
      updateProvisional: vi.fn(),
      flush: vi.fn(() => events.push(`flush:${name}`)),
      close: vi.fn(() => events.push(`close:${name}`)),
    };
  };
  const createA = vi.fn(() => sink('a'));
  const createB = vi.fn(() => sink('b'));
  const A = () => <GalleryDemo create={createA} render={() => <h1>First demo</h1>} />;
  const B = () => <GalleryDemo create={createB} render={() => <h1>Second demo</h1>} />;
  const Probe = () => {
    const session = useGallerySpeech();
    return <button onClick={() => void session?.owner.start()}>Capture</button>;
  };
  const content = (id: string, title: string, Demo: ComponentType) => (
    <GallerySpeechProvider>
      <Probe />
      <GalleryDemoFrame demo={{ id, title }}>
        <Demo />
      </GalleryDemoFrame>
    </GallerySpeechProvider>
  );
  const frame = () => document.querySelector('.gallery-demo-frame') as HTMLElement;
  return {
    content,
    frame,
    A,
    B,
    createA,
    createB,
    drain,
    events,
    observers,
    setHeight: (next: number) => {
      height = next;
    },
  };
};

test('keeps one correctly titled loading frame and the outgoing height through code loading and a drained runtime handoff', async () => {
  const f = fixture();
  const module = deferred<{ default: ComponentType }>();
  const LazyB = lazy(() => module.promise);
  const view = render(f.content('first', 'First demo', f.A));
  await screen.findByRole('heading', { name: 'First demo' });
  await vi.waitFor(() => expect(f.frame().getAttribute('aria-busy')).toBe('false'));
  expect(createMicrophoneTranscriber).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Capture' })));
  view.rerender(f.content('second', 'Second demo', LazyB));
  const loading = screen.getByRole('status');
  expect(loading.textContent).toBe('Loading demo…');
  expect(screen.getAllByRole('heading')).toHaveLength(1);
  expect(screen.getByRole('heading').textContent).toBe('Second demo');
  expect(f.frame().style.minHeight).toBe('640px');
  expect(f.frame().getAttribute('aria-busy')).toBe('true');
  await act(async () => module.resolve({ default: f.B }));
  await vi.waitFor(() => expect(f.events).toContain('stop'));
  expect(f.createB).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toBe(loading);
  expect(screen.queryByText('Preparing demo…')).toBeNull();
  expect(f.frame().style.minHeight).toBe('640px');
  expect(f.events).not.toContain('close:a');
  await act(async () => f.drain.resolve());
  await vi.waitFor(() => expect(f.frame().getAttribute('aria-busy')).toBe('false'));
  expect(f.events.indexOf('close:a')).toBeLessThan(f.events.indexOf('create:b'));
  expect(f.frame().style.minHeight).toBe('');
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getAllByRole('heading')).toHaveLength(1);
  expect(f.createB).toHaveBeenCalledOnce();
  view.unmount();
});

test('tracks natural size changes, ignores an abandoned lazy destination, and releases every measurement observer', async () => {
  const f = fixture();
  const oldModule = deferred<{ default: ComponentType }>();
  const newModule = deferred<{ default: ComponentType }>();
  const Old = lazy(() => oldModule.promise);
  const New = lazy(() => newModule.promise);
  const view = render(f.content('first', 'First demo', f.A));
  await vi.waitFor(() => expect(f.frame().getAttribute('aria-busy')).toBe('false'));
  f.setHeight(1040);
  act(() => f.observers.at(-1)!.resize());
  view.rerender(f.content('abandoned', 'Abandoned demo', Old));
  expect(f.frame().style.minHeight).toBe('1040px');
  view.rerender(f.content('second', 'Second demo', New));
  await act(async () => oldModule.resolve({ default: f.B }));
  expect(f.createB).not.toHaveBeenCalled();
  expect(screen.getByRole('heading').textContent).toBe('Second demo');
  expect(f.frame().getAttribute('aria-busy')).toBe('true');
  f.setHeight(480);
  await act(async () => newModule.resolve({ default: f.B }));
  await vi.waitFor(() => expect(f.frame().getAttribute('aria-busy')).toBe('false'));
  expect(f.frame().style.minHeight).toBe('');
  expect(f.createB).toHaveBeenCalledOnce();
  view.unmount();
  expect(f.observers.length).toBeGreaterThan(0);
  for (const observer of f.observers) expect(observer.disconnect).toHaveBeenCalledOnce();
});

test('returning to a previously ready demo still waits for its new lease', async () => {
  const f = fixture();
  const view = render(f.content('first', 'First demo', f.A));
  await vi.waitFor(() => expect(f.frame().getAttribute('aria-busy')).toBe('false'));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Capture' })));
  view.rerender(f.content('second', 'Second demo', f.B));
  await vi.waitFor(() => expect(f.events).toContain('stop'));
  view.rerender(f.content('first', 'First demo', f.A));
  expect(f.frame().getAttribute('aria-busy')).toBe('true');
  expect(screen.getByRole('status').textContent).toBe('Loading demo…');
  expect(screen.getAllByRole('heading')).toHaveLength(1);
  expect(f.frame().style.minHeight).toBe('640px');
  await act(async () => f.drain.resolve());
  await vi.waitFor(() => expect(f.frame().getAttribute('aria-busy')).toBe('false'));
  expect(f.events.indexOf('close:a')).toBeLessThan(f.events.lastIndexOf('create:a'));
  view.unmount();
});

test('a failed runtime lease reveals the actionable failure rather than leaving a permanent loading frame', async () => {
  const f = fixture();
  const create = () => {
    throw new Error('Could not initialize speech. Reload to try again.');
  };
  const Broken = () => <GalleryDemo create={create} render={() => <h1>Should not render</h1>} />;
  render(f.content('broken', 'Broken demo', Broken));
  expect((await screen.findByRole('alert')).textContent).toContain('Could not initialize speech');
  expect(f.frame().getAttribute('aria-busy')).toBe('false');
  expect(f.frame().style.minHeight).toBe('');
  expect(screen.queryByRole('status')).toBeNull();
});

test('Strict Mode settles the visible lease without keeping abandoned runtimes alive', async () => {
  const f = fixture();
  const view = render(<StrictMode>{f.content('first', 'First demo', f.A)}</StrictMode>);
  await vi.waitFor(() => expect(f.frame().getAttribute('aria-busy')).toBe('false'));
  expect(screen.getAllByRole('heading')).toHaveLength(1);
  view.unmount();
  await vi.waitFor(() =>
    expect(f.events.filter(event => event === 'close:a')).toHaveLength(f.createA.mock.calls.length)
  );
  for (const observer of f.observers) expect(observer.disconnect).toHaveBeenCalledOnce();
});
