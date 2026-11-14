import { BehaviorSubject, type Observable, of } from 'rxjs';
import { expect, expectTypeOf, test, vi } from 'vitest';
import { makeKatakit } from './katakit';
import { makeKatakitPlugin } from './plugin';

test('configuration is evaluated once per configured instance, not once per runtime', () => {
  const configure = vi.fn((options: { initial: number }) => ({
    value: options.initial * 2,
  }));
  const plugin = makeKatakitPlugin({
    type: 'ConfiguredCounter',
    configure,
    observables: ({ options }) => ({ value$: new BehaviorSubject(options.value) }),
    methods: ({ options }) => ({ readConfiguredValue: () => options.value }),
  });
  const first = plugin.configure({ initial: 3 });
  const second = plugin.configure({ initial: 5 });

  const firstRuntime = makeKatakit({ plugins: [first] }).start();
  const reusedRuntime = makeKatakit({ plugins: [first] }).start();
  const secondRuntime = makeKatakit({ plugins: [second] }).start();

  expect(configure.mock.calls).toEqual([[{ initial: 3 }], [{ initial: 5 }]]);
  expect(firstRuntime.getObservables(plugin).value$.value).toBe(6);
  expect(firstRuntime.getMethods(plugin).readConfiguredValue()).toBe(6);
  expect(reusedRuntime.getMethods(plugin).readConfiguredValue()).toBe(6);
  expect(secondRuntime.getMethods(plugin).readConfiguredValue()).toBe(10);
});

test('omitted lifecycle callbacks produce an empty, usable plugin', () => {
  const plugin = makeKatakitPlugin({
    type: 'Empty',
    configure: () => ({}),
  });
  const configured = plugin.configure({});
  const runtime = makeKatakit({ plugins: [configured] }).start();

  expect(runtime.getObservables(plugin)).toEqual({});
  expect(runtime.getMethods(plugin)).toEqual({});
  expect(runtime.getMethods(configured)).toBe(runtime.getMethods(plugin));
});

test('all lifecycle callbacks receive the same configured options and runtime state', () => {
  const optionsSeen: unknown[] = [];
  const plugin = makeKatakitPlugin({
    type: 'Contexts',
    configure: (options: { initial: number }) => ({ ...options, label: 'configured' }),
    observables: ({ options }) => {
      optionsSeen.push(options);
      return { value$: new BehaviorSubject(options.initial) };
    },
    methods: ({ options, observables, getObservables }) => {
      optionsSeen.push(options);
      return {
        read: () => observables.value$.value,
        sameObservables: () => getObservables(plugin) === observables,
      };
    },
    effects: ({ options, observables, methods, getObservables, getMethods }) => {
      optionsSeen.push(options);
      expect(getObservables(plugin)).toBe(observables);
      expect(getMethods(plugin)).toBe(methods);
      expect(methods.read()).toBe(7);
      return [];
    },
  });
  const runtime = makeKatakit({ plugins: [plugin.configure({ initial: 7 })] }).start();

  expect(optionsSeen).toHaveLength(3);
  expect(optionsSeen.every(options => options === optionsSeen[0])).toBe(true);
  expect(optionsSeen[0]).toEqual({ initial: 7, label: 'configured' });
  expect(runtime.getMethods(plugin).sameObservables()).toBe(true);
});

test('configuration failures preserve the original error without constructing runtime resources', () => {
  const failure = new Error('Invalid options');
  const construct = vi.fn(() => ({ value$: of(1) }));
  const plugin = makeKatakitPlugin({
    type: 'InvalidConfiguration',
    configure: (_options: { valid: boolean }) => {
      throw failure;
    },
    observables: construct,
  });

  let caught: unknown;
  try {
    plugin.configure({ valid: false });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(construct).not.toHaveBeenCalled();
});

test('the public factory retains configuration, observable, and method types', () => {
  const plugin = makeKatakitPlugin({
    type: 'Typed',
    configure: (options: { initial: number }) => ({ value: options.initial }),
    observables: ({ options }) => ({ value$: of(options.value) }),
    methods: ({ observables }) => ({
      values: () => observables.value$,
      format: (prefix: string) => `${prefix}: value`,
    }),
  });
  const runtime = makeKatakit({ plugins: [plugin.configure({ initial: 1 })] }).start();

  expectTypeOf(plugin.configure).parameter(0).toEqualTypeOf<{ initial: number }>();
  expectTypeOf(runtime.getObservables(plugin).value$).toEqualTypeOf<Observable<number>>();
  expectTypeOf(runtime.getMethods(plugin).format).toEqualTypeOf<(prefix: string) => string>();
});
