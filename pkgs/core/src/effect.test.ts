import { of, Subject } from 'rxjs';
import { expect, expectTypeOf, test, vi } from 'vitest';
import { makeEffect } from './effect';
import { makeKatakit } from './katakit';
import { makeKatakitPlugin } from './plugin';

test('describing an effect neither subscribes nor invokes its handler', () => {
  const source$ = new Subject<number>();
  const handler = vi.fn();
  const subscribe = vi.spyOn(source$, 'subscribe');
  const config = Object.freeze({ on: source$, backpressure: 'queue' as const, handler });
  const effect = makeEffect(config);

  expect(subscribe).not.toHaveBeenCalled();
  expect(handler).not.toHaveBeenCalled();
  expect(effect.on).toBe(source$);
  expect(effect.handler).toBe(handler);
  expect(effect.backpressure).toBe('queue');
  expect(Object.getOwnPropertySymbols(config)).toEqual([]);
});

test('effect factories infer the observable value in synchronous and asynchronous handlers', () => {
  const synchronousEffect = makeEffect({
    on: of(1),
    backpressure: 'queue',
    handler: value => {
      expectTypeOf(value).toEqualTypeOf<number>();
    },
  });
  const asynchronousEffect = makeEffect({
    on: of('one'),
    backpressure: 'latest',
    handler: async value => {
      expectTypeOf(value).toEqualTypeOf<string>();
    },
  });
  expect(synchronousEffect.on).toBeDefined();
  expect(asynchronousEffect.on).toBeDefined();
});

test('runtime effects use the same methods and dependency state as external callers', async () => {
  const received = Promise.withResolvers<void>();
  const source$ = new Subject<number>();
  const seen: number[] = [];
  const counter = makeKatakitPlugin({
    type: 'Recorder',
    configure: () => ({}),
    methods: () => ({ record: (value: number) => seen.push(value) }),
  });
  const consumer = makeKatakitPlugin({
    type: 'RecordingEffect',
    configure: () => ({}),
    observables: () => ({ input$: source$ }),
    effects: ({ observables, getMethods }) => [
      makeEffect({
        on: observables.input$,
        backpressure: 'queue',
        handler: value => {
          getMethods(counter).record(value);
          received.resolve();
        },
      }),
    ],
  });
  const runtime = makeKatakit({
    plugins: [consumer.configure({}), counter.configure({})],
  }).start();

  try {
    runtime.getMethods(counter).record(1);
    source$.next(2);
    await received.promise;
    expect(seen).toEqual([1, 2]);
  } finally {
    source$.complete();
  }
});
