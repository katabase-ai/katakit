import { eager, evolve, makeKatakit, makeKatakitPlugin, property } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import { startWith } from 'rxjs';
import * as v from 'valibot';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { makeEventPersistencePlugin } from './EventPersistencePlugin/plugin';

const EventSchema = v.variant('type', [
  v.strictObject({ type: v.literal('set'), value: v.number() }),
  v.strictObject({ type: v.literal('add'), amount: v.number() }),
]);
type CounterEvent = v.InferOutput<typeof EventSchema>;

/**
 * Exercises the public composition path: replay -> derived state -> live events -> storage.
 */
const createCounter = ({
  initialEvents,
  appendEvents,
}: {
  initialEvents: CounterEvent[];
  appendEvents: (events: CounterEvent[]) => void | Promise<void>;
}) => {
  const EventLogPlugin = makeEventLogPlugin({ validateEvent: EventSchema });
  const CounterPlugin = makeKatakitPlugin({
    type: 'CounterState',
    configure: () => ({}),
    observables: ({ getObservables }) => ({
      total$: property(
        eager(
          getObservables(EventLogPlugin).events$.pipe(
            evolve(
              (total, event) => (event.type === 'set' ? event.value : total + event.amount),
              0
            ),
            startWith(0)
          )
        )
      ),
    }),
  });
  const PersistencePlugin = makeEventPersistencePlugin({
    EventLogPlugin,
    appendEvents,
    persistInterval: 20,
  });
  const kit = makeKatakit({
    plugins: [
      CounterPlugin.configure({}),
      PersistencePlugin.configure({}),
      EventLogPlugin.configure({ initialEvents }),
    ],
  });
  const total$ = kit.getObservables(CounterPlugin).total$;
  const runtime = kit.start();
  return {
    total$,
    emitEvent: runtime.getMethods(EventLogPlugin).emitEvent,
    events$: runtime.getObservables(EventLogPlugin).events$,
    kill: runtime.getMethods(PersistencePlugin).kill,
  };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test('restarting from persisted history reconstructs exactly the live derived state', async () => {
  const durable: CounterEvent[] = [
    { type: 'set', value: 10 },
    { type: 'add', amount: 1 },
  ];
  const append = vi.fn((events: CounterEvent[]) => {
    durable.push(...events);
  });
  const first = createCounter({ initialEvents: [...durable], appendEvents: append });
  expect(first.total$.get()).toBe(11);
  first.emitEvent({ type: 'add', amount: 2 });
  first.emitEvent({ type: 'set', value: 5 });
  first.emitEvent({ type: 'add', amount: 3 });
  expect(first.total$.get()).toBe(8);
  await first.kill();
  expect(append.mock.calls).toEqual([
    [
      [
        { type: 'add', amount: 2 },
        { type: 'set', value: 5 },
        { type: 'add', amount: 3 },
      ],
    ],
  ]);

  const second = createCounter({ initialEvents: [...durable], appendEvents: append });
  expect(second.total$.get()).toBe(first.total$.get());
  expect(second.events$.getAll()).toEqual(first.events$.getAll());
  expect(second.total$.getAll()).toEqual(first.total$.getAll());
  await vi.advanceTimersByTimeAsync(40);
  await second.kill();
  expect(append).toHaveBeenCalledOnce();
});

test('recovery preserves replay semantics when a failed batch precedes a newer state change', async () => {
  const durable: CounterEvent[] = [];
  const failure = new Error('Storage temporarily unavailable');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const append = vi.fn((events: CounterEvent[]) => {
    durable.push(...events);
  });
  append.mockImplementationOnce(() => {
    throw failure;
  });
  const first = createCounter({ initialEvents: [], appendEvents: append });
  first.emitEvent({ type: 'set', value: 10 });
  await vi.advanceTimersByTimeAsync(20);
  expect(durable).toEqual([]);
  first.emitEvent({ type: 'add', amount: 3 });
  await vi.advanceTimersByTimeAsync(20);
  await first.kill();
  expect(durable).toEqual([
    { type: 'set', value: 10 },
    { type: 'add', amount: 3 },
  ]);

  const recovered = createCounter({ initialEvents: [...durable], appendEvents: append });
  expect(recovered.total$.get()).toBe(13);
  expect(recovered.total$.get()).toBe(first.total$.get());
  await recovered.kill();
});

test('independent runtimes do not share derived state or persistence batches', async () => {
  const firstSaved: CounterEvent[] = [];
  const secondSaved: CounterEvent[] = [];
  const first = createCounter({
    initialEvents: [{ type: 'set', value: 1 }],
    appendEvents: events => {
      firstSaved.push(...events);
    },
  });
  const second = createCounter({
    initialEvents: [{ type: 'set', value: 10 }],
    appendEvents: events => {
      secondSaved.push(...events);
    },
  });
  first.emitEvent({ type: 'add', amount: 2 });
  second.emitEvent({ type: 'add', amount: 5 });
  await Promise.all([first.kill(), second.kill()]);
  expect(first.total$.get()).toBe(3);
  expect(second.total$.get()).toBe(15);
  expect(firstSaved).toEqual([{ type: 'add', amount: 2 }]);
  expect(secondSaved).toEqual([{ type: 'add', amount: 5 }]);
});

// TODO: Re-enable when nested event delivery preserves the durable log's ordering.
test.skip('state-triggered events persist in the same order used to derive live state', async () => {
  const durable: CounterEvent[] = [];
  const appendEvents = (events: CounterEvent[]) => {
    durable.push(...events);
  };
  const first = createCounter({ initialEvents: [], appendEvents });
  const subscription = first.total$.subscribe(total => {
    if (total === 1) first.emitEvent({ type: 'add', amount: 2 });
  });
  try {
    first.emitEvent({ type: 'set', value: 1 });
    expect(first.total$.get()).toBe(3);
    await first.kill();
    const recovered = createCounter({ initialEvents: [...durable], appendEvents });
    try {
      expect(durable).toEqual(first.events$.getAll());
      expect(recovered.total$.get()).toBe(first.total$.get());
    } finally {
      await recovered.kill();
    }
  } finally {
    subscription.unsubscribe();
    await first.kill();
  }
});
