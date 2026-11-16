import { act, fireEvent, within } from '@testing-library/react';
import { BehaviorSubject } from 'rxjs';
import { afterEach, expect, test, vi } from 'vitest';
import { makeKatakit, makeKatakitPlugin } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import { createDevToolsStore, mountDevTools, type MountedDevTools } from './mount';

const cleanups: (() => void)[] = [];
afterEach(() => {
  act(() =>
    cleanups
      .splice(0)
      .toReversed()
      .forEach(cleanup => cleanup())
  );
});

const setup = () => {
  const container = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = 'Host panel';
  container.append(heading);
  document.body.append(container);
  cleanups.push(() => container.remove());
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
  cleanups.push(() => runtime.getMethods(transcript).close());
  const store = createDevToolsStore();
  const options = {
    runtime,
    store,
    transcript: {
      observables: runtime.getObservables(transcript),
      methods: runtime.getMethods(transcript),
    },
  };
  const mount = () => {
    let handle!: MountedDevTools;
    act(() => {
      handle = mountDevTools(container, options);
    });
    cleanups.push(handle.unmount);
    return handle;
  };
  return { container, heading, value$, runtime, plugin, options, store, mount };
};

test('mounts in a host container and releases only its own UI and subscriptions on unmount', () => {
  const { container, heading, value$, runtime, plugin, mount, store } = setup();
  const handle = mount();
  expect(value$.observed).toBe(true);
  fireEvent.click(within(container).getByRole('button', { name: 'Open developer workbench' }));
  fireEvent.click(within(container).getByRole('tab', { name: 'State & capabilities' }));
  act(() => runtime.getMethods(plugin).increment());
  expect(within(container).getByText('1')).toBeTruthy();
  const records = store.getSnapshot().activity.length;
  act(handle.unmount);
  expect(value$.observed).toBe(false);
  expect(Array.from(container.children)).toEqual([heading]);
  expect(store.getSnapshot().activity).toHaveLength(records);
  runtime.getMethods(plugin).increment();
  expect(value$.value).toBe(2);
});

test('rejects duplicate mounts, allows remounting, and makes old teardown handles harmless', () => {
  const { container, options, mount, value$ } = setup();
  const first = mount();
  expect(() => mountDevTools(container, options)).toThrow('already mounted');
  act(first.unmount);
  const second = mount();
  act(first.unmount);
  expect(value$.observed).toBe(true);
  expect(() => first.update({})).toThrow('unmounted');
  expect(() => mountDevTools(container, options)).toThrow('already mounted');
  act(second.unmount);
  expect(value$.observed).toBe(false);
});

test('updates host microphone state without resetting drafts or taking ownership of capture', () => {
  const { container, options, mount } = setup();
  const handle = mount();
  const onToggle = vi.fn();
  fireEvent.click(within(container).getByRole('button', { name: 'Open developer workbench' }));
  fireEvent.click(within(container).getByRole('tab', { name: 'Transcript & input' }));
  fireEvent.change(within(container).getByLabelText('Text'), { target: { value: 'Draft text' } });
  act(() =>
    handle.update({
      transcript: {
        ...options.transcript,
        input: { status: 'listening', recording: true, onToggle },
      },
    })
  );
  expect((within(container).getByLabelText('Text') as HTMLTextAreaElement).value).toBe(
    'Draft text'
  );
  expect(within(container).getByText('listening')).toBeTruthy();
  expect(onToggle).not.toHaveBeenCalled();
  fireEvent.click(within(container).getByRole('button', { name: 'Stop microphone' }));
  expect(onToggle).toHaveBeenCalledOnce();
  act(() => handle.update({ transcript: undefined }));
  expect(within(container).queryByRole('tab', { name: 'Transcript & input' })).toBeNull();
  expect(
    within(container).getByRole('tab', { name: 'Activity' }).getAttribute('aria-selected')
  ).toBe('true');
  act(handle.unmount);
  expect(onToggle).toHaveBeenCalledOnce();
});

test('unmounts safely before the initial scheduled render', () => {
  const { container, heading, options, value$ } = setup();
  act(() => {
    const handle = mountDevTools(container, options);
    handle.unmount();
    handle.unmount();
  });
  expect(Array.from(container.children)).toEqual([heading]);
  expect(value$.observed).toBe(false);
});
