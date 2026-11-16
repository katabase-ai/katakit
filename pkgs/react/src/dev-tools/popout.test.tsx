import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { makeKatakit, makeKatakitPlugin } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import { BehaviorSubject } from 'rxjs';
import { afterEach, expect, test, vi } from 'vitest';
import { DevTools, createDevToolsStore } from './index';
import { mountDevTools, type MountedDevTools } from './mount';

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanup();
  act(() =>
    cleanups
      .splice(0)
      .toReversed()
      .forEach(dispose => dispose())
  );
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const setup = () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const popup = frame.contentWindow!;
  const close = vi.spyOn(popup, 'close').mockImplementation(() => {});
  const focus = vi.spyOn(popup, 'focus').mockImplementation(() => {});
  const openWindow = vi.fn(() => popup);
  const value$ = new BehaviorSubject(0);
  const plugin = makeKatakitPlugin({
    type: 'Counter',
    configure: () => ({}),
    observables: () => ({ value$ }),
    methods: () => ({ increment: () => value$.next(value$.value + 1) }),
  });
  const transcript = makeTranscriptIngestionPlugin();
  const runtime = makeKatakit({
    plugins: [plugin.configure({}), transcript.configure({})],
    tracer: false,
  }).start();
  const store = createDevToolsStore();
  const input = { status: 'listening', recording: true, onToggle: vi.fn() };
  const props = {
    runtime,
    store,
    popout: { openWindow },
    transcript: {
      observables: runtime.getObservables(transcript),
      methods: runtime.getMethods(transcript),
      input,
    },
  };
  cleanups.push(() => {
    runtime.getMethods(transcript).close();
    frame.remove();
  });
  return { popup, close, focus, openWindow, value$, plugin, runtime, store, props, input };
};

test('moves the existing workbench between documents without losing drafts, selection or capture', () => {
  const fixture = setup();
  const connect = vi.spyOn(fixture.store, 'connect');
  const app = render(<DevTools {...fixture.props} />);
  const inline = within(app.container);
  fireEvent.click(inline.getByRole('button', { name: 'Open developer workbench' }));
  fireEvent.click(inline.getByRole('tab', { name: 'Transcript & input' }));
  const draft = inline.getByLabelText('Text');
  fireEvent.change(draft, { target: { value: 'Keep this draft' } });
  fireEvent.click(inline.getByRole('button', { name: 'Pop out workbench' }));
  const popped = within(fixture.popup.document.body);
  expect(popped.getByLabelText('Text')).toBe(draft);
  expect((popped.getByLabelText('Text') as HTMLTextAreaElement).value).toBe('Keep this draft');
  expect(
    popped.getByRole('tab', { name: 'Transcript & input' }).getAttribute('aria-selected')
  ).toBe('true');
  fireEvent.change(popped.getByLabelText('Text'), { target: { value: 'Input from the popout' } });
  fireEvent.click(popped.getByRole('button', { name: 'Submit segment' }));
  expect(fixture.props.transcript.observables.currentTurn$.get()?.text).toBe(
    'Input from the popout'
  );
  fireEvent.change(popped.getByLabelText('Text'), { target: { value: 'Another draft' } });
  expect(inline.queryByRole('tab')).toBeNull();
  expect(inline.getByRole('status').textContent).toContain('Capture continues');
  act(() => fixture.runtime.getMethods(fixture.plugin).increment());
  expect(fixture.store.getSnapshot().values['["Counter","value$"]']?.value).toBe('1');
  expect(connect).toHaveBeenCalledOnce();
  expect(fixture.input.onToggle).not.toHaveBeenCalled();
  fireEvent.click(popped.getByRole('button', { name: 'Dock workbench' }));
  expect(inline.getByLabelText('Text')).toBe(draft);
  expect((inline.getByLabelText('Text') as HTMLTextAreaElement).value).toBe('Another draft');
  expect(fixture.close).toHaveBeenCalledOnce();
  expect(fixture.value$.observed).toBe(true);
  expect(connect).toHaveBeenCalledOnce();
});

test('mirrors loaded styles and returns inline when the popout closes', async () => {
  const fixture = setup();
  const style = document.createElement('style');
  style.textContent = '.kk-workbench { color: red; }';
  document.head.append(style);
  cleanups.push(() => style.remove());
  const app = render(<DevTools {...fixture.props} />);
  fireEvent.click(within(app.container).getByRole('button', { name: 'Pop out workbench' }));
  expect(fixture.popup.document.head.textContent).toContain('color: red');
  await act(async () => {
    style.textContent = '.kk-workbench { color: blue; }';
  });
  await waitFor(() => expect(fixture.popup.document.head.textContent).toContain('color: blue'));
  act(() => fixture.popup.dispatchEvent(new Event('pagehide')));
  expect(within(app.container).getByRole('button', { name: 'Pop out workbench' })).toBeTruthy();
  expect(fixture.value$.observed).toBe(true);
  expect(fixture.input.onToggle).not.toHaveBeenCalled();
});

test('reports blocked or inaccessible windows and keeps inline controls usable', () => {
  const fixture = setup();
  const openWindow = vi.fn(() => null);
  const app = render(<DevTools {...fixture.props} popout={{ openWindow }} />);
  const inline = within(app.container);
  fireEvent.click(inline.getByRole('button', { name: 'Pop out workbench' }));
  expect(inline.getByRole('alert').textContent).toContain('blocked');
  fireEvent.click(inline.getByRole('button', { name: 'Open developer workbench' }));
  expect(inline.getByRole('tab', { name: 'Activity' })).toBeTruthy();
  app.rerender(<DevTools {...fixture.props} popout={{ openWindow: () => window }} />);
  fireEvent.click(inline.getByRole('button', { name: 'Pop out workbench' }));
  expect(inline.getByRole('alert').textContent).toContain('same-origin');
});

test('imperative popout opens synchronously, reuses the window, docks on disable and closes on teardown', () => {
  const fixture = setup();
  const container = document.createElement('div');
  document.body.append(container);
  cleanups.push(() => container.remove());
  let handle!: MountedDevTools;
  act(() => {
    handle = mountDevTools(container, fixture.props);
    expect(handle.popOut()).toBe(true); // No render/effect wait may consume the user gesture.
    expect(fixture.openWindow).toHaveBeenCalledOnce();
  });
  cleanups.push(handle.unmount);
  act(() => expect(handle.popOut()).toBe(true));
  expect(fixture.openWindow).toHaveBeenCalledOnce();
  act(() => handle.update({ popout: false }));
  expect(handle.popOut()).toBe(false);
  expect(within(container).queryByRole('button', { name: 'Pop out workbench' })).toBeNull();
  act(() => handle.update({ popout: fixture.props.popout }));
  act(() => handle.popOut());
  act(handle.unmount);
  expect(fixture.close).toHaveBeenCalledTimes(2);
  expect(fixture.value$.observed).toBe(false);
  expect(fixture.input.onToggle).not.toHaveBeenCalled();
  expect(handle.popOut()).toBe(false);
});

test('direct React lifecycle remains safe in StrictMode and closes the owned popup on unmount', () => {
  const fixture = setup();
  const app = render(
    <StrictMode>
      <DevTools {...fixture.props} />
    </StrictMode>
  );
  fireEvent.click(within(app.container).getByRole('button', { name: 'Pop out workbench' }));
  app.unmount();
  expect(fixture.close).toHaveBeenCalledOnce();
  expect(fixture.value$.observed).toBe(false);
});

test('detects a closed window when a host does not emit pagehide', () => {
  vi.useFakeTimers();
  const fixture = setup();
  const app = render(<DevTools {...fixture.props} />);
  fireEvent.click(within(app.container).getByRole('button', { name: 'Pop out workbench' }));
  Object.defineProperty(fixture.popup, 'closed', { configurable: true, value: true });
  act(() => vi.advanceTimersByTime(500));
  expect(within(app.container).getByRole('button', { name: 'Pop out workbench' })).toBeTruthy();
  expect(fixture.value$.observed).toBe(true);
});

test('source pagehide closes the popout and leaves the inline surface reusable after page restoration', () => {
  const fixture = setup();
  const app = render(<DevTools {...fixture.props} />);
  const inline = within(app.container);
  fireEvent.click(inline.getByRole('button', { name: 'Pop out workbench' }));
  act(() => window.dispatchEvent(new Event('pagehide')));
  expect(fixture.close).toHaveBeenCalledOnce();
  fireEvent.click(inline.getByRole('button', { name: 'Pop out workbench' }));
  expect(fixture.openWindow).toHaveBeenCalledTimes(2);
  app.unmount();
  expect(fixture.close).toHaveBeenCalledTimes(2);
});
