import { makeKatakit, makeKatakitPlugin } from '@katakit/core';
import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { Subject } from 'rxjs';
import { afterEach, expect, test, vi } from 'vitest';
import { useCapture } from './capture';

afterEach(() => vi.unstubAllGlobals());

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
