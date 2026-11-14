import { BehaviorSubject, map, Observable, of, ReplaySubject, type Subscriber } from 'rxjs';
import { describe, test } from 'vitest';
import { expect } from 'vitest';
import { eager } from './eager';

/**
 * #CARE: These tests are hand-written.
 */
describe('memoized', () => {
  test('throws replay failures to the constructing caller', () => {
    const source = new ReplaySubject<number>();
    const failure = new Error('Invalid persisted event');
    source.next(1);
    source.error(failure);

    expect(() => eager(source)).toThrow(failure);
  });

  test('invalidates cached history after a live failure and forwards it downstream', () => {
    const source = new ReplaySubject<number>();
    const cached = eager(source);
    const failures: unknown[] = [];
    cached.subscribe({ error: error => failures.push(error) });
    source.next(1);
    expect(cached.getAll()).toEqual([1]);

    const failure = new Error('Observable failed');
    source.error(failure);

    expect(failures).toEqual([failure]);
    expect(() => cached.getAll()).toThrow(failure);
  });

  test('returns empty array if observable does not emit a value', () => {
    const observable = new ReplaySubject<number>(Infinity);
    const p = eager(observable);
    expect(p.getAll()).toEqual([]);
  });

  test('returns all values from the observable', () => {
    const observable = new ReplaySubject<number>(Infinity);
    observable.next(1);
    observable.next(2);
    observable.next(3);

    const p = eager(observable);
    expect(p.getAll()).toEqual([1, 2, 3]);
  });

  test('updates the values when the observable emits a new value', () => {
    const observable = new ReplaySubject<number>(Infinity);
    const p = eager(observable);

    observable.next(1);

    expect(p.getAll()).toEqual([1]);

    observable.next(2);

    expect(p.getAll()).toEqual([1, 2]);
  });

  test('downstream subscription is free', () => {
    const observable = new ReplaySubject<number>(Infinity);

    let counter = 0;
    const derived = observable.pipe(
      map(v => {
        counter++;
        return v;
      })
    );

    const m = eager(derived);

    m.subscribe(() => {});
    m.subscribe(() => {});

    observable.next(1);
    observable.next(2);

    expect(counter).toBe(2);
    expect(m.getAll()).toEqual([1, 2]);
  });
});

describe('eager caching contracts', () => {
  test('history snapshots cannot mutate cached arrays or grow after later events', () => {
    const source$ = new ReplaySubject<number>();
    const cached$ = eager(source$);
    source$.next(1);
    const snapshot = cached$.getAll();
    source$.next(2);
    expect(snapshot).toEqual([1]);
    snapshot.push(99);
    expect(cached$.getAll()).toEqual([1, 2]);
    source$.complete();
  });

  test('cold derivations execute once and late subscribers receive the full history', () => {
    let subscriptions = 0;
    const cached$ = eager(
      new Observable<number>(subscriber => {
        subscriptions++;
        subscriber.next(1);
        subscriber.next(2);
        subscriber.complete();
      })
    );
    const first: number[] = [];
    const second: number[] = [];
    cached$.subscribe(value => first.push(value));
    cached$.subscribe(value => second.push(value));
    expect(subscriptions).toBe(1);
    expect(first).toEqual([1, 2]);
    expect(second).toEqual(first);
    expect(cached$.getAll()).toEqual(first);
  });

  test('completion preserves the cache and reaches late subscribers', () => {
    const cached$ = eager(of(0, 0, 1));
    const seen: number[] = [];
    let completed = false;
    cached$.subscribe({
      next: value => seen.push(value),
      complete: () => {
        completed = true;
      },
    });
    expect(seen).toEqual([0, 0, 1]);
    expect(completed).toBe(true);
    expect(cached$.getAll()).toEqual(seen);
  });

  // TODO: Re-enable when eager's runtime capabilities agree with its subtype return type.
  test.skip('retains the subtype methods promised by its public return type', () => {
    const source$ = new BehaviorSubject(1);
    const cached$ = eager(source$);
    try {
      expect(cached$.getValue()).toBe(1);
      source$.next(2);
      expect(cached$.getValue()).toBe(2);
      expect(cached$.getAll()).toEqual([1, 2]);
    } finally {
      source$.complete();
    }
  });

  // TODO: Re-enable when a failed eager cache cannot restart its upstream source.
  test.skip('a live failure remains terminal instead of rerunning a cold derivation for late subscribers', () => {
    let subscriptions = 0;
    let upstream: Subscriber<number> | undefined;
    const failure = new Error('Derivation failed');
    const cached$ = eager(
      new Observable<number>(subscriber => {
        subscriptions++;
        upstream = subscriber;
        subscriber.next(1);
      })
    );
    upstream?.error(failure);
    let received: unknown;
    const subscription = cached$.subscribe({
      error: error => {
        received = error;
      },
    });
    try {
      expect(subscriptions).toBe(1);
      expect(received).toBe(failure);
      expect(() => cached$.getAll()).toThrow(failure);
    } finally {
      subscription.unsubscribe();
      upstream?.complete();
    }
  });
});
