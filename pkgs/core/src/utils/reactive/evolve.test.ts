import { Observable, of, ReplaySubject, Subject, take } from 'rxjs';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';
import { evolve } from './evolve';

/**
 * #CARE: These tests are hand-written.
 */
describe('evolve', () => {
  test('emits the evolver result for each source emission', () => {
    const source = new Subject<number>();
    const seen: number[] = [];

    source.pipe(evolve((acc, cur) => acc + cur, 0)).subscribe(value => seen.push(value));

    source.next(1);
    source.next(2);
    source.next(3);

    expect(seen).toEqual([1, 3, 6]);
  });

  test('does not emit the seed before any source emission', () => {
    const source = new Subject<number>();
    const seen: number[] = [];

    source.pipe(evolve((acc, cur) => acc + cur, 100)).subscribe(value => seen.push(value));

    expect(seen).toEqual([]);
  });

  test('passes the seed to the evolver on the first emission, then the previous result', () => {
    const source = new Subject<number>();
    const accs: (string | number)[] = [];

    source
      .pipe(
        evolve((acc, cur) => {
          accs.push(acc);
          return typeof acc === 'string' ? cur : acc + cur;
        }, 'seed')
      )
      .subscribe();

    source.next(1);
    source.next(2);
    source.next(3);

    expect(accs).toEqual(['seed', 1, 3]);
  });

  test('supports a seed type distinct from the evolved state type (event-sourcing pattern)', () => {
    type Event = { type: 'init'; value: number } | { type: 'add'; value: number };
    type State = { total: number };

    const source = new Subject<Event>();
    const seen: State[] = [];

    source
      .pipe(
        evolve(
          (acc, event) => {
            if (event.type === 'init') return { total: event.value };
            if (acc === undefined) throw new Error('not initialized');
            return { total: acc.total + event.value };
          },
          undefined as State | undefined
        )
      )
      .subscribe(state => seen.push(state));

    source.next({ type: 'init', value: 10 });
    source.next({ type: 'add', value: 5 });
    source.next({ type: 'add', value: 2 });

    expect(seen).toEqual([{ total: 10 }, { total: 15 }, { total: 17 }]);
  });

  test('replays past emissions from a ReplaySubject through the evolver per subscriber', () => {
    const source = new ReplaySubject<number>(Infinity);
    source.next(1);
    source.next(2);
    source.next(3);

    const seen: number[] = [];
    source.pipe(evolve((acc, cur) => acc + cur, 0)).subscribe(value => seen.push(value));

    expect(seen).toEqual([1, 3, 6]);
  });

  test('forwards source completion', () => {
    const source = new Subject<number>();
    let completed = false;

    source.pipe(evolve((acc, cur) => acc + cur, 0)).subscribe({
      complete: () => {
        completed = true;
      },
    });

    source.next(1);
    expect(completed).toBe(false);
    source.complete();
    expect(completed).toBe(true);
  });

  test('forwards source errors', () => {
    const source = new Subject<number>();
    const seen: number[] = [];
    let caught: unknown;

    source.pipe(evolve((acc, cur) => acc + cur, 0)).subscribe({
      next: value => seen.push(value),
      error: error => {
        caught = error;
      },
    });

    source.next(1);
    source.error(new Error('upstream'));

    expect(seen).toEqual([1]);
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('upstream');
  });

  test('errors thrown inside the evolver propagate downstream and stop emissions', () => {
    const source = new Subject<number>();
    const seen: number[] = [];
    let caught: unknown;

    source
      .pipe(
        evolve((_acc, cur) => {
          if (cur === 2) throw new Error('boom');
          return cur;
        }, 0)
      )
      .subscribe({
        next: value => seen.push(value),
        error: error => {
          caught = error;
        },
      });

    source.next(1);
    source.next(2);
    source.next(3);

    expect(seen).toEqual([1]);
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('boom');
  });

  test('each subscriber gets an independent accumulator', () => {
    const source = new ReplaySubject<number>(Infinity);
    source.next(1);
    source.next(2);

    const seenA: number[] = [];
    const seenB: number[] = [];
    const evolved = source.pipe(evolve((acc, cur) => acc + cur, 0));

    evolved.subscribe(value => seenA.push(value));
    evolved.subscribe(value => seenB.push(value));

    source.next(3);

    expect(seenA).toEqual([1, 3, 6]);
    expect(seenB).toEqual([1, 3, 6]);
  });
});

describe('evolve cancellation and output contracts', () => {
  test('unsubscribing downstream releases a live upstream subscription', () => {
    const teardown = vi.fn();
    const source$ = new Observable<number>(() => teardown);
    const subscription = source$.pipe(evolve((total, value) => total + value, 0)).subscribe();
    subscription.unsubscribe();
    expect(teardown).toHaveBeenCalledOnce();
  });

  // TODO: Re-enable when synchronous sources honor downstream cancellation.
  test.skip('downstream cancellation stops reducing the rest of a synchronous source', () => {
    const reduce = vi.fn((total: number, value: number) => total + value);
    const seen: number[] = [];
    of(1, 2, 3)
      .pipe(evolve(reduce, 0), take(1))
      .subscribe(value => seen.push(value));
    expect(seen).toEqual([1]);
    expect(reduce).toHaveBeenCalledOnce();
  });

  // TODO: Re-enable when a reducer failure stops the remaining synchronous replay.
  test.skip('a reducer failure stops subsequent reducer work during synchronous replay', () => {
    const failure = new Error('Invalid event');
    const reduce = vi.fn((total: number, value: number) => {
      if (value === 2) throw failure;
      return total + value;
    });
    const seen: number[] = [];
    const error = vi.fn();
    of(1, 2, 3)
      .pipe(evolve(reduce, 0))
      .subscribe({
        next: value => seen.push(value),
        error,
      });
    expect(seen).toEqual([1]);
    expect(error).toHaveBeenCalledExactlyOnceWith(failure);
    expect(reduce).toHaveBeenCalledTimes(2);
  });

  test('distinct seed and result types still expose only evolved results downstream', () => {
    const state$ = of(2, 3).pipe(
      evolve(
        (state, value) => ({ total: (typeof state === 'string' ? 0 : state.total) + value }),
        'uninitialized' as string | { total: number }
      )
    );
    const seen: { total: number }[] = [];
    state$.subscribe(state => seen.push(state));
    expect(seen).toEqual([{ total: 2 }, { total: 5 }]);
    expectTypeOf(state$).toEqualTypeOf<Observable<{ total: number }>>();
  });
});
