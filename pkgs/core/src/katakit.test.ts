import { BehaviorSubject, map, Subject } from 'rxjs';
import { expect, test, vi } from 'vitest';
import { makeEffect } from './effect';
import { makeKatakit } from './katakit';
import { makeKatakitPlugin } from './plugin';

test('an empty runtime starts once without requiring any plugins', () => {
  const runtime = makeKatakit({ plugins: [] });
  expect(runtime.start().getObservables).toBe(runtime.getObservables);
  expect(() => runtime.start()).toThrow(/already started/i);
});

test('a failing devtools hook cannot interrupt or repeat observable construction', () => {
  const hook = Symbol.for('katakit.devtools.observables.v1');
  const streams = { value$: new Subject<number>() };
  const observables = vi.fn(() => streams);
  const plugin = makeKatakitPlugin({ type: 'Counter', configure: () => ({}), observables });
  const runtime = makeKatakit({ plugins: [plugin.configure({})] });
  vi.stubGlobal(hook, () => {
    throw new Error('recorder unavailable');
  });
  try {
    expect(runtime.getObservables(plugin)).toBe(streams);
    expect(runtime.start().getObservables(plugin)).toBe(streams);
    expect(observables).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
  }
});

test('observable-only access is lazy and never starts methods or effects', () => {
  const constructObservables = vi.fn(() => ({ value$: new BehaviorSubject(1) }));
  const constructMethods = vi.fn(() => ({ read: () => 1 }));
  const constructEffects = vi.fn(() => []);
  const plugin = makeKatakitPlugin({
    type: 'Lazy',
    configure: () => ({}),
    observables: constructObservables,
    methods: constructMethods,
    effects: constructEffects,
  });
  const configured = plugin.configure({});
  const kit = makeKatakit({ plugins: [configured] });

  expect(constructObservables).not.toHaveBeenCalled();
  const beforeStart = kit.getObservables(plugin);
  expect(kit.getObservables(configured)).toBe(beforeStart);
  expect(constructObservables).toHaveBeenCalledOnce();
  expect(constructMethods).not.toHaveBeenCalled();
  expect(constructEffects).not.toHaveBeenCalled();

  const alive = kit.start();
  expect(alive.getObservables(plugin)).toBe(beforeStart);
  expect(constructObservables).toHaveBeenCalledOnce();
  expect(constructMethods).toHaveBeenCalledOnce();
  expect(constructEffects).toHaveBeenCalledOnce();
});

test.each([false, true])(
  'dependencies can be registered before or after their consumers: %s',
  reverse => {
    const counter = makeKatakitPlugin({
      type: 'Counter',
      configure: () => ({}),
      observables: () => ({ count$: new BehaviorSubject(2) }),
      methods: ({ observables }) => ({
        increment: () => observables.count$.next(observables.count$.value + 1),
      }),
    });
    const doubled = makeKatakitPlugin({
      type: 'Doubled',
      configure: () => ({}),
      observables: ({ getObservables }) => ({
        doubled$: getObservables(counter).count$.pipe(map(value => value * 2)),
      }),
      methods: ({ getMethods }) => ({ increment: () => getMethods(counter).increment() }),
    });
    const plugins = [counter.configure({}), doubled.configure({})];
    const runtime = makeKatakit({ plugins: reverse ? plugins.toReversed() : plugins }).start();
    const seen: number[] = [];
    const subscription = runtime
      .getObservables(doubled)
      .doubled$.subscribe(value => seen.push(value));

    try {
      runtime.getMethods(doubled).increment();
      expect(seen).toEqual([4, 6]);
      expect(runtime.getObservables(counter).count$.value).toBe(3);
    } finally {
      subscription.unsubscribe();
    }
  }
);

test('separate runtimes have independent observable state even with the same configured plugin', () => {
  const plugin = makeKatakitPlugin({
    type: 'State',
    configure: () => ({}),
    observables: () => ({ value$: new BehaviorSubject(0) }),
  });
  const configured = plugin.configure({});
  const first = makeKatakit({ plugins: [configured] });
  const second = makeKatakit({ plugins: [configured] });
  const firstState = first.getObservables(plugin);
  const secondState = second.getObservables(plugin);
  firstState.value$.next(10);

  expect(secondState).not.toBe(firstState);
  expect(secondState.value$.value).toBe(0);
});

test('missing plugin lookups fail with the missing type rather than returning empty state', () => {
  const missing = makeKatakitPlugin({ type: 'Missing', configure: () => ({}) });
  const kit = makeKatakit({ plugins: [] });
  expect(() => kit.getObservables(missing)).toThrow(/Missing/);
  const runtime = kit.start();
  expect(() => runtime.getMethods(missing)).toThrow(/Missing/);
});

test('a second start fails before constructing methods or subscribing effects again', async () => {
  const input$ = new Subject<number>();
  const handled = Promise.withResolvers<void>();
  const values: number[] = [];
  const constructMethods = vi.fn(() => ({ read: () => values }));
  const plugin = makeKatakitPlugin({
    type: 'SingleStart',
    configure: () => ({}),
    methods: constructMethods,
    effects: () => [
      makeEffect({
        on: input$,
        backpressure: 'queue',
        handler: value => {
          values.push(value);
          handled.resolve();
        },
      }),
    ],
  });
  const kit = makeKatakit({ plugins: [plugin.configure({})] });
  kit.start();

  try {
    expect(() => kit.start()).toThrow(/already started/i);
    expect(constructMethods).toHaveBeenCalledOnce();
    input$.next(3);
    await handled.promise;
    expect(values).toEqual([3]);
  } finally {
    input$.complete();
  }
});

test('observable construction failures are not cached as a partially built plugin', () => {
  const failure = new Error('Construction failed');
  const construct = vi
    .fn(() => ({ value$: new BehaviorSubject(1) }))
    .mockImplementationOnce(() => {
      throw failure;
    });
  const plugin = makeKatakitPlugin({
    type: 'RetryConstruction',
    configure: () => ({}),
    observables: construct,
  });
  const runtime = makeKatakit({ plugins: [plugin.configure({})] });

  expect(() => runtime.getObservables(plugin)).toThrow(failure);
  expect(runtime.getObservables(plugin).value$.value).toBe(1);
  expect(construct).toHaveBeenCalledTimes(2);
});

// TODO: Re-enable when type-based lookup rejects ambiguous registrations.
test.skip('duplicate plugin types are rejected before either configuration can be silently selected', () => {
  // Lookup is type-based, so accepting this configuration would erase the second instance.
  const plugin = makeKatakitPlugin({
    type: 'Duplicate',
    configure: (options: { value: number }) => options,
    observables: ({ options }) => ({ value$: new BehaviorSubject(options.value) }),
  });

  expect(() =>
    makeKatakit({
      plugins: [plugin.configure({ value: 1 }), plugin.configure({ value: 2 })],
    }).start()
  ).toThrow(/duplicate|already registered|ambiguous/i);
});
