import { expect, expectTypeOf, test } from 'vitest';
import { EventLogPlugin, makeKatakit } from '../index';

test('the built-in log cannot be registered manually, even with no runtime history', () => {
  expect(() =>
    makeKatakit({ plugins: [EventLogPlugin.configure({ existingEvents: [] })] })
  ).toThrow('Duplicate plugin type: EventLog');
});

test('replays restored history before start, then delivers live events on the same stream', () => {
  const kit = makeKatakit({
    plugins: [],
    existingEvents: [
      { type: 'first', meta: { seq: 0, timestamp: new Date() } },
      { type: 'second', meta: { seq: 1, timestamp: new Date() } },
    ],
  });
  const { events$ } = kit.getObservables(EventLogPlugin);
  const seen: unknown[] = [];
  const subscription = events$.subscribe(event => seen.push(event));
  try {
    expect(seen).toEqual(['first', 'second']);
    const snapshot = events$.getAll();
    const alive = kit.start();
    expect(alive.getObservables(EventLogPlugin).events$).toBe(events$);
    alive.getMethods(EventLogPlugin).emitEvent('third');
    expect(seen).toEqual(['first', 'second', 'third']);
    expect(snapshot).toEqual(['first', 'second']);
    snapshot.pop();
    expect(events$.getAll()).toEqual(seen);
    const late: unknown[] = [];
    events$.subscribe(event => late.push(event)).unsubscribe();
    expect(late).toEqual(seen);
    expectTypeOf(events$).not.toHaveProperty('next');
  } finally {
    subscription.unsubscribe();
  }
});

test('runtimes start with independent empty logs when no history is provided', () => {
  const config = { plugins: [] };
  const first = makeKatakit(config).start();
  const second = makeKatakit(config).start();
  first.getMethods(EventLogPlugin).emitEvent(false);
  expect(first.getObservables(EventLogPlugin).events$.getAll()).toEqual([false]);
  expect(second.getObservables(EventLogPlugin).events$.getAll()).toEqual([]);
});
