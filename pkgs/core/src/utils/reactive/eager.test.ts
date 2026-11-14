/**
 * #CARE: These tests are hand-written
 */

import { map, ReplaySubject } from 'rxjs';
import { describe, test } from 'vitest';
import { expect } from 'vitest';
import { eager } from './eager';

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
