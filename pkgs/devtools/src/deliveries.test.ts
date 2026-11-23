import { makeKatakit, makeKatakitPlugin, property } from '@katakit/core';
import { BehaviorSubject, defer, finalize, map, take } from 'rxjs';
import { expect, test, vi } from 'vitest';
import { installRecorder, type Delivery } from './deliveries';

test('records real subscriptions, including replay, without changing source execution or teardown', () => {
  const history: Delivery[] = [];
  const stop = installRecorder(event => history.push(event));
  const teardown = vi.fn();
  const source = new BehaviorSubject(1);
  const subscribe = vi.fn(() => source.pipe(finalize(teardown)));
  const plugin = makeKatakitPlugin({
    type: 'Counter',
    configure: () => ({}),
    observables: () => ({ count$: property(source), cold$: defer(subscribe) }),
  });
  try {
    const runtime = makeKatakit({ plugins: [plugin.configure({})] }).start();
    const { count$, cold$ } = runtime.getObservables(plugin);
    expect(subscribe).not.toHaveBeenCalled();
    expect(history).toHaveLength(0);
    const first = count$.pipe(map(x => x * 2)).subscribe();
    const second = count$.asObservable().subscribe();
    const publishFromApplication = () => {
      count$.next(2);
    };
    publishFromApplication();
    expect(count$.get()).toBe(2);
    expect(count$.value).toBe(2);
    expect(history.map(e => [e.subscription, e.value])).toEqual([
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
    ]);
    expect(history[2]!.stack).toContain('publishFromApplication');
    second.unsubscribe();
    cold$.pipe(take(1)).subscribe();
    expect(subscribe).toHaveBeenCalledOnce();
    expect(teardown).toHaveBeenCalledOnce();
    expect(history.at(-1)?.lane).toBe('#1 Counter.cold$');
    stop();
    publishFromApplication();
    expect(count$.get()).toBe(2);
    expect(history).toHaveLength(5);
    first.unsubscribe();
  } finally {
    stop();
  }
});

test('separates aliases and runtimes without modifying shared observables', () => {
  const events: Delivery[] = [];
  const stop = installRecorder(event => events.push(event));
  const shared = new BehaviorSubject('replayed');
  const plugin = makeKatakitPlugin({
    type: 'Alias',
    configure: () => ({}),
    observables: () => ({ a$: shared, b$: shared }),
  });
  try {
    for (let i = 0; i < 2; i++) {
      const streams = makeKatakit({ plugins: [plugin.configure({})] }).getObservables(plugin);
      streams.a$.subscribe().unsubscribe();
      streams.b$.subscribe().unsubscribe();
    }
    shared.subscribe().unsubscribe();
    expect(events.map(e => e.lane)).toEqual([
      '#1 Alias.a$',
      '#1 Alias.b$',
      '#2 Alias.a$',
      '#2 Alias.b$',
    ]);
  } finally {
    stop();
  }
});
