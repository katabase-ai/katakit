import { BehaviorSubject, EMPTY, map, of, ReplaySubject } from 'rxjs';
import { describe, test } from 'vitest';
import { optionalProperty, property } from './property';
import { expect, expectTypeOf } from 'vitest';

/**
 * #CARE: These tests are hand-written.
 */
describe('property', () => {
  test.each([optionalProperty, property])('rejects an incomplete replay', wrap => {
    const source = new ReplaySubject<number>();
    const failure = new Error('Invalid persisted event');
    source.next(1);
    source.error(failure);

    expect(() => wrap(source)).toThrow(failure);
  });

  test('invalidates the last value after a live failure', () => {
    const source = new ReplaySubject<number>();
    source.next(1);
    const current = property(source);
    expect(current.get()).toBe(1);

    const failure = new Error('Observable failed');
    source.error(failure);

    expect(() => current.get()).toThrow(failure);
  });

  test('returns undefined if observable does not emit a value', () => {
    const observable = new ReplaySubject<number>(Infinity);
    const p = optionalProperty(observable);
    expect(p.get()).toBe(undefined);
  });

  test('returns the latest value from the observable', () => {
    const observable = new ReplaySubject<number>(Infinity);
    observable.next(1);

    const p = optionalProperty(observable);
    expect(p.get()).toBe(1);
  });

  test('updates the value when the observable emits a new value', () => {
    const observable = new ReplaySubject<number>(Infinity);
    const p = optionalProperty(observable);

    observable.next(1);

    expect(p.get()).toBe(1);

    observable.next(2);

    expect(p.get()).toBe(2);
  });

  test('still has an independent downstream subscriptions', () => {
    const observable = new ReplaySubject<number>(Infinity);
    const p = optionalProperty(observable);
    const a: number[] = [];
    p.subscribe(v => a.push(v));

    expect(p.get()).toBe(undefined);
    expect(a).toEqual([]);

    observable.next(1);

    expect(p.get()).toBe(1);
    expect(a).toEqual([1]);
  });

  test('from derived observable', () => {
    const observable = new ReplaySubject<number>(Infinity);
    const derived = observable.pipe(map(v => v * 2));

    const p = optionalProperty(derived);
    observable.next(1);
    expect(p.get()).toBe(2);

    observable.next(2);
    expect(p.get()).toBe(4);
  });
});

describe('property initialization and completion contracts', () => {
  test('required properties reject an empty synchronous replay', () => {
    expect(() => property(EMPTY)).toThrow(/undefined|initial|value/i);
  });

  test.each([0, false, ''])('a falsy first value is initialized: %s', value => {
    const current$ = property(of(value));
    expect(current$.get()).toBe(value);
    expect(current$.get()).toBe(value);
  });

  test('completion preserves the most recent synchronous value', () => {
    const source$ = new ReplaySubject<number>();
    source$.next(1);
    const current$ = property(source$);
    source$.next(2);
    source$.complete();
    expect(current$.get()).toBe(2);
    expect(current$.get()).toBe(2);
  });

  test('an optional property remains empty after completion without a value', () => {
    expect(optionalProperty(EMPTY).get()).toBeUndefined();
  });

  test('property augmentation preserves the original observable subtype and methods', () => {
    const source$ = new BehaviorSubject({ count: 1 });
    const current$ = property(source$);
    expect(current$).toBe(source$);
    current$.next({ count: 2 });
    expect(current$.get()).toEqual({ count: 2 });
    expect(current$.getValue()).toBe(current$.get());
    expectTypeOf(current$.get()).toEqualTypeOf<{ count: number }>();
    source$.complete();
  });
});
