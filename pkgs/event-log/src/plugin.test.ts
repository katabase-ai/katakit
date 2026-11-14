import { makeKatakit } from '@katakit/core';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Observable } from 'rxjs';
import * as v from 'valibot';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';
import { makeEventLogPlugin } from '@katakit/event-log';

const EventSchema = v.variant('type', [
  v.strictObject({
    type: v.literal('message'),
    text: v.pipe(v.string(), v.trim(), v.minLength(1)),
  }),
  v.strictObject({
    type: v.literal('countSet'),
    value: v.number(),
  }),
]);
type TestEvent = v.InferOutput<typeof EventSchema>;

const createLog = ({
  initialEvents = [],
  validateEvent = EventSchema,
}: {
  initialEvents?: TestEvent[];
  validateEvent?: StandardSchemaV1<unknown, TestEvent>;
} = {}) => {
  const plugin = makeEventLogPlugin({ validateEvent });
  const configured = plugin.configure({ initialEvents });
  const runtime = makeKatakit({ plugins: [configured] });
  return { plugin, configured, runtime };
};

describe('event log', () => {
  test('reconstructs ordered history without starting the runtime', () => {
    const initialEvents: TestEvent[] = [
      { type: 'countSet', value: 1 },
      { type: 'message', text: 'Ready' },
      { type: 'countSet', value: 2 },
    ];
    const { plugin, runtime } = createLog({ initialEvents });
    const { events$ } = runtime.getObservables(plugin);
    const seen: TestEvent[] = [];
    const subscription = events$.subscribe(event => seen.push(event));

    try {
      expect(seen).toEqual(initialEvents);
      expect(events$.getAll()).toEqual(initialEvents);
      expect(runtime.getObservables(plugin).events$).toBe(events$);
    } finally {
      subscription.unsubscribe();
    }
  });

  test('publishes synchronously and replays every event to late subscribers exactly once', () => {
    const { plugin, runtime } = createLog();
    const alive = runtime.start();
    const { events$ } = runtime.getObservables(plugin);
    const { emitEvent } = alive.getMethods(plugin);
    const first: TestEvent = { type: 'countSet', value: 1 };
    const second: TestEvent = { type: 'message', text: 'Ready' };
    const third: TestEvent = { type: 'countSet', value: 2 };

    emitEvent(first);
    emitEvent(second);
    const seen: TestEvent[] = [];
    const subscription = events$.subscribe(event => seen.push(event));

    try {
      expect(seen).toEqual([first, second]);
      emitEvent(third);
      expect(seen).toEqual([first, second, third]);
      expect(events$.getAll()).toEqual(seen);
      expect(alive.getObservables(plugin).events$).toBe(events$);
    } finally {
      subscription.unsubscribe();
    }
  });

  test('returns history snapshots that cannot change the log or grow after later writes', () => {
    const { plugin, runtime } = createLog();
    const alive = runtime.start();
    const { events$ } = alive.getObservables(plugin);
    const { emitEvent } = alive.getMethods(plugin);
    const first: TestEvent = { type: 'countSet', value: 1 };
    const second: TestEvent = { type: 'countSet', value: 2 };

    emitEvent(first);
    const snapshot = events$.getAll();
    emitEvent(second);

    expect(snapshot).toEqual([first]);
    snapshot.length = 0;
    expect(events$.getAll()).toEqual([first, second]);
  });

  test.each([
    { type: 'countSet', value: 'not a number' },
    { type: 'message', text: '   ' },
  ])(
    'rejects invalid input without changing history or notifying subscribers: $type',
    invalidEvent => {
      const existing: TestEvent = { type: 'message', text: 'Saved' };
      const { plugin, runtime } = createLog({ initialEvents: [existing] });
      const alive = runtime.start();
      const { events$ } = alive.getObservables(plugin);
      const { emitEvent } = alive.getMethods(plugin);
      const seen: TestEvent[] = [];
      const subscription = events$.subscribe(event => seen.push(event));

      try {
        // Exercise a runtime boundary where a caller has bypassed the TypeScript contract.
        expect(() => emitEvent(invalidEvent as never)).toThrowError(
          expect.objectContaining({
            message: 'Invalid event',
            cause: expect.arrayContaining([
              expect.objectContaining({ message: expect.any(String) }),
            ]),
          })
        );
        expect(events$.getAll()).toEqual([existing]);
        expect(seen).toEqual([existing]);
      } finally {
        subscription.unsubscribe();
      }
    }
  );

  test('publishes the schema output rather than the unnormalized caller input', () => {
    const { plugin, runtime } = createLog();
    const alive = runtime.start();
    const { events$ } = alive.getObservables(plugin);
    const input: TestEvent = { type: 'message', text: '  Ready  ' };

    alive.getMethods(plugin).emitEvent(input);

    expect(events$.getAll()).toEqual([{ type: 'message', text: 'Ready' }]);
    expect(input.text).toBe('  Ready  ');
  });

  test('rejects asynchronous validation synchronously without committing an event', () => {
    const event: TestEvent = { type: 'countSet', value: 1 };
    const validateEvent: StandardSchemaV1<unknown, TestEvent> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: async () => ({ value: event }),
      },
    };
    const { plugin, runtime } = createLog({ validateEvent });
    const alive = runtime.start();

    expect(() => alive.getMethods(plugin).emitEvent(event)).toThrow(
      'Event validation must be synchronous'
    );
    expect(alive.getObservables(plugin).events$.getAll()).toEqual([]);
  });

  test('preserves a thrown validator error and leaves history unchanged', () => {
    const failure = new Error('Validator failed');
    const validateEvent: StandardSchemaV1<unknown, TestEvent> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: () => {
          throw failure;
        },
      },
    };
    const { plugin, runtime } = createLog({ validateEvent });
    const alive = runtime.start();

    expect(() => alive.getMethods(plugin).emitEvent({ type: 'countSet', value: 1 })).toThrow(
      failure
    );
    expect(alive.getObservables(plugin).events$.getAll()).toEqual([]);
  });

  test('isolates runtimes even when they reuse the same configured plugin', () => {
    const { plugin, configured, runtime } = createLog();
    const first = runtime.start();
    const second = makeKatakit({ plugins: [configured] }).start();
    const firstEvents$ = first.getObservables(plugin).events$;
    const secondEvents$ = second.getObservables(plugin).events$;

    first.getMethods(plugin).emitEvent({ type: 'countSet', value: 1 });
    second.getMethods(plugin).emitEvent({ type: 'countSet', value: 2 });

    expect(firstEvents$).not.toBe(secondEvents$);
    expect(firstEvents$.getAll()).toEqual([{ type: 'countSet', value: 1 }]);
    expect(secondEvents$.getAll()).toEqual([{ type: 'countSet', value: 2 }]);
  });

  test('supports primitive events without requiring a discriminator or metadata', () => {
    const plugin = makeEventLogPlugin({ validateEvent: v.string() });
    const runtime = makeKatakit({
      plugins: [plugin.configure({ initialEvents: ['first'] })],
    }).start();

    runtime.getMethods(plugin).emitEvent('second');

    expect(runtime.getObservables(plugin).events$.getAll()).toEqual(['first', 'second']);
  });

  test('infers observable, history, and method types from the schema', () => {
    const { plugin, runtime } = createLog();
    const alive = runtime.start();
    const { events$ } = alive.getObservables(plugin);
    const { emitEvent } = alive.getMethods(plugin);

    expectTypeOf(events$).toExtend<Observable<TestEvent>>();
    expectTypeOf(events$.getAll()).toEqualTypeOf<TestEvent[]>();
    expectTypeOf(emitEvent).toEqualTypeOf<(event: TestEvent) => void>();
    expectTypeOf(events$).not.toHaveProperty('next');
  });
});

describe('event-log validation and delivery contracts', () => {
  test.each([undefined, false, 0, ''])('preserves successful falsy schema outputs: %j', value => {
    const plugin = makeEventLogPlugin({
      validateEvent: v.union([v.undefined(), v.boolean(), v.number(), v.string()]),
    });
    const runtime = makeKatakit({
      plugins: [plugin.configure({ initialEvents: [] })],
    }).start();
    runtime.getMethods(plugin).emitEvent(value);
    expect(runtime.getObservables(plugin).events$.getAll()).toEqual([value]);
  });

  test('issues take precedence over a partial value returned by a validator', () => {
    const issues = [{ message: 'Partial parse failed' }];
    const plugin = makeEventLogPlugin<number>({
      validateEvent: {
        '~standard': {
          version: 1,
          vendor: 'contract-test',
          validate: () => ({ value: 10, issues }),
        },
      },
    });
    const runtime = makeKatakit({
      plugins: [plugin.configure({ initialEvents: [1] })],
    }).start();
    const seen: number[] = [];
    const subscription = runtime
      .getObservables(plugin)
      .events$.subscribe(event => seen.push(event));

    try {
      expect(() => runtime.getMethods(plugin).emitEvent(10)).toThrow(
        expect.objectContaining({ message: 'Invalid event', cause: issues })
      );
      expect(seen).toEqual([1]);
      expect(runtime.getObservables(plugin).events$.getAll()).toEqual([1]);
    } finally {
      subscription.unsubscribe();
    }
  });

  test('a rejected live event does not poison later valid emissions', () => {
    const plugin = makeEventLogPlugin<number>({
      validateEvent: {
        '~standard': {
          version: 1,
          vendor: 'contract-test',
          validate: value =>
            value === 2 ? { issues: [{ message: 'Rejected' }] } : { value: value as number },
        },
      },
    });
    const runtime = makeKatakit({
      plugins: [plugin.configure({ initialEvents: [] })],
    }).start();
    const { emitEvent } = runtime.getMethods(plugin);
    emitEvent(1);
    expect(() => emitEvent(2)).toThrow('Invalid event');
    emitEvent(3);
    expect(runtime.getObservables(plugin).events$.getAll()).toEqual([1, 3]);
  });

  test('hydrated canonical events are not transformed or revalidated as live inputs', () => {
    const validate = vi.fn((value: unknown) => ({ value: `${value}!` }));
    const plugin = makeEventLogPlugin<string>({
      validateEvent: { '~standard': { version: 1, vendor: 'contract-test', validate } },
    });
    const runtime = makeKatakit({
      plugins: [plugin.configure({ initialEvents: ['already normalized!'] })],
    }).start();
    expect(validate).not.toHaveBeenCalled();
    runtime.getMethods(plugin).emitEvent('new');
    expect(validate).toHaveBeenCalledExactlyOnceWith('new');
    expect(runtime.getObservables(plugin).events$.getAll()).toEqual([
      'already normalized!',
      'new!',
    ]);
  });

  test('unsubscribing one reader neither stops the log nor affects other readers', () => {
    const plugin = makeEventLogPlugin({ validateEvent: v.number() });
    const runtime = makeKatakit({
      plugins: [plugin.configure({ initialEvents: [] })],
    }).start();
    const { events$ } = runtime.getObservables(plugin);
    const first: number[] = [];
    const second: number[] = [];
    const firstSubscription = events$.subscribe(value => first.push(value));
    const secondSubscription = events$.subscribe(value => second.push(value));
    try {
      runtime.getMethods(plugin).emitEvent(1);
      firstSubscription.unsubscribe();
      runtime.getMethods(plugin).emitEvent(2);
      expect(first).toEqual([1]);
      expect(second).toEqual([1, 2]);
      expect(events$.getAll()).toEqual([1, 2]);
    } finally {
      firstSubscription.unsubscribe();
      secondSubscription.unsubscribe();
    }
  });

  test('a synchronous burst has the same complete order in live delivery and replay', () => {
    const plugin = makeEventLogPlugin({ validateEvent: v.number() });
    const runtime = makeKatakit({
      plugins: [plugin.configure({ initialEvents: [] })],
    }).start();
    const { events$ } = runtime.getObservables(plugin);
    const values = Array.from({ length: 1000 }, (_, index) => index % 17);
    const seen: number[] = [];
    const subscription = events$.subscribe(event => seen.push(event));
    try {
      for (const value of values) runtime.getMethods(plugin).emitEvent(value);
      expect(seen).toEqual(values);
      expect(events$.getAll()).toEqual(values);
      const replay: number[] = [];
      const lateSubscription = events$.subscribe(event => replay.push(event));
      lateSubscription.unsubscribe();
      expect(replay).toEqual(values);
    } finally {
      subscription.unsubscribe();
    }
  });

  // TODO: Re-enable when nested emissions cannot overtake an event's current delivery.
  test.skip('reader-triggered emissions preserve the log order for every reader', () => {
    const plugin = makeEventLogPlugin({ validateEvent: v.number() });
    const runtime = makeKatakit({
      plugins: [plugin.configure({ initialEvents: [] })],
    }).start();
    const { events$ } = runtime.getObservables(plugin);
    const { emitEvent } = runtime.getMethods(plugin);
    const first: number[] = [];
    const second: number[] = [];
    const firstSubscription = events$.subscribe(value => {
      first.push(value);
      if (value === 1) emitEvent(2);
    });
    const secondSubscription = events$.subscribe(value => second.push(value));
    try {
      emitEvent(1);
      expect(events$.getAll()).toEqual([1, 2]);
      expect(first).toEqual([1, 2]);
      expect(second).toEqual([1, 2]);
    } finally {
      firstSubscription.unsubscribe();
      secondSubscription.unsubscribe();
    }
  });
});
