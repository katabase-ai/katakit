import { makeKatakit } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { makeEventPersistencePlugin } from './plugin';

const createPersistence = ({
  initialEvents = [],
  persistInterval,
  appendEvents,
}: {
  initialEvents?: number[];
  persistInterval?: number;
  appendEvents?: (events: number[]) => void | Promise<void>;
} = {}) => {
  const EventLogPlugin = makeEventLogPlugin({ validateEvent: v.number() });
  const append = vi.fn(appendEvents ?? ((_events: number[]) => {}));
  const PersistencePlugin = makeEventPersistencePlugin({
    EventLogPlugin,
    appendEvents: append,
    persistInterval,
  });
  const kit = makeKatakit({
    plugins: [EventLogPlugin.configure({ initialEvents }), PersistencePlugin.configure({})],
  });
  const runtime = kit.start();
  return {
    append,
    events$: runtime.getObservables(EventLogPlugin).events$,
    emitEvent: runtime.getMethods(EventLogPlugin).emitEvent,
    kill: runtime.getMethods(PersistencePlugin).kill,
    methods: runtime.getMethods(PersistencePlugin),
    runtime,
    PersistencePlugin,
  };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // Broken shutdown behavior must not leave real timers running after a failing assertion.
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('persistence initialization and batching', () => {
  test('factory creation, configuration, and observable-only access start no timer or storage work', () => {
    const EventLogPlugin = makeEventLogPlugin({ validateEvent: v.number() });
    const appendEvents = vi.fn();
    const PersistencePlugin = makeEventPersistencePlugin({ EventLogPlugin, appendEvents });
    const kit = makeKatakit({
      plugins: [
        EventLogPlugin.configure({ initialEvents: [1, 2] }),
        PersistencePlugin.configure({}),
      ],
    });

    expect(kit.getObservables(EventLogPlugin).events$.getAll()).toEqual([1, 2]);
    expect(kit.getObservables(PersistencePlugin)).toEqual({});
    expect(appendEvents).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('hydrated history is already durable and is never appended again', async () => {
    const fixture = createPersistence({ initialEvents: [1, 2] });
    await vi.advanceTimersByTimeAsync(15000);
    expect(fixture.append).not.toHaveBeenCalled();

    fixture.emitEvent(3);
    await fixture.kill();
    expect(fixture.append.mock.calls).toEqual([[[3]]]);
    expect(fixture.events$.getAll()).toEqual([1, 2, 3]);
  });

  test.each([
    { persistInterval: undefined, interval: 5000 },
    { persistInterval: 20, interval: 20 },
  ])('batches at the configured interval: $interval ms', async ({ persistInterval, interval }) => {
    const fixture = createPersistence({ persistInterval });
    fixture.emitEvent(1);
    fixture.emitEvent(1);
    fixture.emitEvent(2);
    await vi.advanceTimersByTimeAsync(interval - 1);
    expect(fixture.append).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fixture.append.mock.calls).toEqual([[[1, 1, 2]]]);

    await vi.advanceTimersByTimeAsync(interval);
    expect(fixture.append).toHaveBeenCalledOnce();
    fixture.emitEvent(3);
    await vi.advanceTimersByTimeAsync(interval);
    expect(fixture.append.mock.calls).toEqual([[[1, 1, 2]], [[3]]]);
    await fixture.kill();
  });

  test('empty intervals and empty shutdowns never call the adapter', async () => {
    const fixture = createPersistence();
    await vi.advanceTimersByTimeAsync(20000);
    await fixture.kill();
    expect(fixture.append).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('repeated method lookups share one queue and one timer', async () => {
    const fixture = createPersistence();
    expect(fixture.runtime.getMethods(fixture.PersistencePlugin)).toBe(fixture.methods);
    expect(vi.getTimerCount()).toBe(1);
    fixture.emitEvent(1);
    await fixture.kill();
    expect(fixture.append.mock.calls).toEqual([[[1]]]);
  });
});

describe('persistence serialization and recovery', () => {
  test('slow writes never overlap and do not absorb events accepted after their batch began', async () => {
    const firstWrite = Promise.withResolvers<void>();
    let active = 0;
    let maximumActive = 0;
    const fixture = createPersistence({
      persistInterval: 20,
      appendEvents: async events => {
        active++;
        maximumActive = Math.max(maximumActive, active);
        if (events[0] === 1) await firstWrite.promise;
        active--;
      },
    });

    try {
      fixture.emitEvent(1);
      await vi.advanceTimersByTimeAsync(20);
      fixture.emitEvent(2);
      await vi.advanceTimersByTimeAsync(60);
      fixture.emitEvent(3);
      expect(fixture.append.mock.calls).toEqual([[[1]]]);
      expect(maximumActive).toBe(1);
      firstWrite.resolve();
      await vi.advanceTimersByTimeAsync(0);
      await fixture.kill();
      expect(fixture.append.mock.calls).toEqual([[[1]], [[2, 3]]]);
      expect(maximumActive).toBe(1);
    } finally {
      firstWrite.resolve();
    }
  });

  test('a failed in-flight batch is retried before events accepted during the write', async () => {
    const firstWrite = Promise.withResolvers<void>();
    const failure = new Error('Transaction rolled back');
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    let attempt = 0;
    const fixture = createPersistence({
      persistInterval: 20,
      appendEvents: async () => {
        if (++attempt === 1) await firstWrite.promise;
      },
    });

    try {
      fixture.emitEvent(1);
      await vi.advanceTimersByTimeAsync(20);
      fixture.emitEvent(2);
      firstWrite.reject(failure);
      await vi.advanceTimersByTimeAsync(0);
      expect(report).toHaveBeenCalledExactlyOnceWith('Failed to flush events:', failure);
      expect(fixture.append.mock.calls).toEqual([[[1]]]);
      await vi.advanceTimersByTimeAsync(20);
      expect(fixture.append.mock.calls).toEqual([[[1]], [[1, 2]]]);
      expect(fixture.events$.getAll()).toEqual([1, 2]);
      await vi.advanceTimersByTimeAsync(20);
      await fixture.kill();
      expect(fixture.append).toHaveBeenCalledTimes(2);
    } finally {
      firstWrite.resolve();
    }
  });

  test.each(['throw', 'reject'] as const)(
    'a storage %s is retried even if no newer event arrives',
    async type => {
      const failure = new Error('Temporary storage failure');
      const report = vi.spyOn(console, 'error').mockImplementation(() => {});
      let attempt = 0;
      const fixture = createPersistence({
        persistInterval: 20,
        appendEvents: () => {
          if (++attempt !== 1) return;
          if (type === 'throw') throw failure;
          return Promise.reject(failure);
        },
      });
      fixture.emitEvent(0);
      await vi.advanceTimersByTimeAsync(20);
      expect(report).toHaveBeenCalledExactlyOnceWith('Failed to flush events:', failure);
      await vi.advanceTimersByTimeAsync(20);
      await fixture.kill();
      expect(fixture.append.mock.calls).toEqual([[[0]], [[0]]]);
    }
  );

  test('method-owned pending batches remain isolated when configured plugins are reused', async () => {
    const EventLogPlugin = makeEventLogPlugin({ validateEvent: v.number() });
    const append = vi.fn((_events: number[]) => {});
    const PersistencePlugin = makeEventPersistencePlugin({ EventLogPlugin, appendEvents: append });
    const plugins = [
      EventLogPlugin.configure({ initialEvents: [10] }),
      PersistencePlugin.configure({}),
    ];
    const first = makeKatakit({ plugins }).start();
    const second = makeKatakit({ plugins }).start();
    first.getMethods(EventLogPlugin).emitEvent(1);
    second.getMethods(EventLogPlugin).emitEvent(2);

    await first.getMethods(PersistencePlugin).kill();
    expect(append.mock.calls).toEqual([[[1]]]);
    await second.getMethods(PersistencePlugin).kill();
    expect(append.mock.calls).toEqual([[[1]], [[2]]]);
  });

  test('repeated failed retries preserve every event and its order until a write succeeds', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    let attempt = 0;
    const fixture = createPersistence({
      persistInterval: 20,
      appendEvents: () => {
        if (++attempt <= 3) throw new Error('Offline');
      },
    });
    fixture.emitEvent(1);
    await vi.advanceTimersByTimeAsync(20);
    fixture.emitEvent(2);
    await vi.advanceTimersByTimeAsync(20);
    fixture.emitEvent(3);
    await vi.advanceTimersByTimeAsync(20);
    await vi.advanceTimersByTimeAsync(20);
    await fixture.kill();
    expect(fixture.append.mock.calls).toEqual([[[1]], [[1, 2]], [[1, 2, 3]], [[1, 2, 3]]]);
    expect(report).toHaveBeenCalledTimes(3);
  });
});

describe('persistence shutdown safety', () => {
  test('shutdown flushes immediately without waiting for the periodic timer', async () => {
    const fixture = createPersistence();
    fixture.emitEvent(1);
    await fixture.kill();
    expect(fixture.append.mock.calls).toEqual([[[1]]]);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(20000);
    await fixture.kill();
    expect(fixture.append).toHaveBeenCalledOnce();
  });

  test('shutdown waits for the active write and then persists its remaining suffix', async () => {
    const firstWrite = Promise.withResolvers<void>();
    const fixture = createPersistence({
      persistInterval: 20,
      appendEvents: async events => {
        if (events[0] === 1) await firstWrite.promise;
      },
    });
    try {
      fixture.emitEvent(1);
      await vi.advanceTimersByTimeAsync(20);
      fixture.emitEvent(2);
      let settled = false;
      const shutdown = (async () => {
        await fixture.kill();
        settled = true;
      })();
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      firstWrite.resolve();
      await shutdown;
      expect(fixture.append.mock.calls).toEqual([[[1]], [[2]]]);
    } finally {
      firstWrite.resolve();
    }
  });

  test('concurrent shutdown callers wait for the same accepted events without duplicate writes', async () => {
    const write = Promise.withResolvers<void>();
    const fixture = createPersistence({
      appendEvents: async () => write.promise,
    });
    fixture.emitEvent(1);
    const first = fixture.kill();
    const second = fixture.kill();
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(fixture.append.mock.calls).toEqual([[[1]]]);
      write.resolve();
      await Promise.all([first, second]);
      expect(fixture.append).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      write.resolve();
    }
  });

  // TODO: Re-enable when shutdown propagates final-save failures to its caller.
  test.skip('a failed final write rejects shutdown rather than acknowledging unsaved events', async () => {
    // This is a safety regression test, not an assertion of the documented current limitation.
    const failure = new Error('Final save failed');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fixture = createPersistence({
      appendEvents: () => {
        throw failure;
      },
    });
    fixture.emitEvent(1);
    await expect(fixture.kill()).rejects.toBe(failure);
  });

  // TODO: Re-enable when shutdown unsubscribes from live events.
  test.skip('shutdown releases its event subscription as well as its timer', async () => {
    const EventLogPlugin = makeEventLogPlugin({ validateEvent: v.number() });
    const PersistencePlugin = makeEventPersistencePlugin({
      EventLogPlugin,
      appendEvents: () => {},
    });
    const kit = makeKatakit({
      plugins: [EventLogPlugin.configure({ initialEvents: [] }), PersistencePlugin.configure({})],
    });
    const subscribe = vi.spyOn(kit.getObservables(EventLogPlugin).events$, 'subscribe');
    const runtime = kit.start();
    expect(subscribe).toHaveBeenCalledOnce();
    const subscription = subscribe.mock.results[0]?.value;
    await runtime.getMethods(PersistencePlugin).kill();
    expect(subscription?.closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
