import { makeKatakit, makeKatakitPlugin } from '@katakit/core';
import { act, render, renderHook } from '@testing-library/react';
import { createElement, StrictMode } from 'react';
import { Subject } from 'rxjs';
import { afterEach, expect, test, vi } from 'vitest';
import { useCapture } from './capture';

afterEach(() => vi.unstubAllGlobals());

test('Bingo → Transcription → Bingo starts a recording per visit and ignores late deliveries', () => {
  let publish: FrameRequestCallback;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    publish = callback;
    return 1;
  });
  const cancel = vi.fn();
  vi.stubGlobal('cancelAnimationFrame', cancel);
  const plugin = makeKatakitPlugin({
    type: 'Example',
    configure: () => ({}),
    observables: () => ({ value$: new Subject<string>() }),
  });
  const startRuntime = () => {
    const { value$ } = makeKatakit({ plugins: [plugin.configure({})] }).getObservables(plugin);
    const subscription = value$.subscribe();
    return { value$, subscription };
  };
  const Panel = () =>
    useCapture()
      .map(delivery => String(delivery.value))
      .join(', ');
  const visit = (demo: string) => createElement(Panel, { key: demo });
  const view = render(visit('bingo'), { wrapper: StrictMode });
  const first = startRuntime();
  first.value$.next('first board');
  act(() => publish(0));
  expect(view.container.textContent).toBe('first board');
  first.value$.next('unpublished');

  view.rerender(visit('transcription'));
  expect(cancel).toHaveBeenCalledWith(1);
  expect(view.container.textContent).toBe('');
  const second = startRuntime();
  first.value$.next('late bingo');
  second.value$.next('current transcript');
  act(() => publish(1));
  expect(view.container.textContent).toBe('current transcript');

  view.rerender(visit('bingo'));
  expect(view.container.textContent).toBe('');
  const third = startRuntime();
  first.value$.next('old board');
  second.value$.next('late transcript');
  third.value$.next('new board');
  act(() => publish(2));
  expect(view.container.textContent).toBe('new board');
  for (const runtime of [first, second, third]) runtime.subscription.unsubscribe();
  view.unmount();
});

test('panels share one bounded recording across remounts and release the pending frame on final unmount', async () => {
  let publish: FrameRequestCallback;
  const schedule = vi.fn((callback: FrameRequestCallback) => {
    publish = callback;
    return schedule.mock.calls.length - 1; // Zero is a valid frame handle.
  });
  const cancel = vi.fn();
  vi.stubGlobal('requestAnimationFrame', schedule);
  vi.stubGlobal('cancelAnimationFrame', cancel);
  const plugin = makeKatakitPlugin({
    type: 'Samples',
    configure: () => ({}),
    observables: () => ({ sample$: new Subject<number>() }),
  });
  const first = renderHook(useCapture, { wrapper: StrictMode });
  const second = renderHook(useCapture);
  const runtime = makeKatakit({ plugins: [plugin.configure({})] });
  const { sample$ } = runtime.getObservables(plugin);
  const subscription = sample$.subscribe();
  try {
    for (let i = 0; i <= 500; i++) sample$.next(i);
    expect(schedule).toHaveBeenCalledTimes(1);
    act(() => publish(0));
    expect(first.result.current).toBe(second.result.current);
    expect(first.result.current).toHaveLength(500);
    expect(first.result.current[0]?.value).toBe(1);
    first.unmount();
    await Promise.resolve();
    sample$.next(501);
    act(() => publish(1));
    expect(second.result.current[0]?.value).toBe(2);
    sample$.next(502);
    second.unmount();
    await Promise.resolve();
    expect(cancel).toHaveBeenCalledWith(2);
    sample$.next(503);
    expect(schedule).toHaveBeenCalledTimes(3);
    const fresh = renderHook(useCapture);
    expect(fresh.result.current).toHaveLength(0);
    fresh.unmount();
  } finally {
    subscription.unsubscribe();
    first.unmount();
    second.unmount();
    await Promise.resolve();
  }
});
