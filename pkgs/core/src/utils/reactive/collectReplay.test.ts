import { Observable, of, ReplaySubject, Subject } from 'rxjs';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';
import { collectReplay } from './collectReplay';

describe('collectReplay', () => {
  test('returns empty array when the observable has not emitted', () => {
    const subject = new ReplaySubject<number>(Infinity);
    expect(collectReplay(subject)).toEqual([]);
  });

  test('returns the whole replay buffer of a ReplaySubject', () => {
    const subject = new ReplaySubject<number>(Infinity);
    subject.next(1);
    subject.next(2);
    subject.next(3);

    expect(collectReplay(subject)).toEqual([1, 2, 3]);
  });

  test('returns all values from a completed observable', () => {
    expect(collectReplay(of(1, 2, 3))).toEqual([1, 2, 3]);
  });

  test('only returns values up to the point of collection', () => {
    const subject = new ReplaySubject<number>(Infinity);
    subject.next(1);
    subject.next(2);

    expect(collectReplay(subject)).toEqual([1, 2]);

    subject.next(3);

    expect(collectReplay(subject)).toEqual([1, 2, 3]);
  });

  test('respects a limited replay buffer size', () => {
    const subject = new ReplaySubject<number>(2);
    subject.next(1);
    subject.next(2);
    subject.next(3);

    expect(collectReplay(subject)).toEqual([2, 3]);
  });

  test('does not capture values emitted asynchronously after collection', () => {
    const subject = new ReplaySubject<number>(Infinity);
    const values = collectReplay(subject);

    subject.next(1);

    expect(values).toEqual([]);
  });

  test('returns empty array for a plain Subject with no replay', () => {
    const subject = new Subject<number>();
    subject.next(1);

    expect(collectReplay(subject)).toEqual([]);
  });
});

describe('collectReplay subscription ownership', () => {
  test('immediately releases the subscription without waiting for source completion', () => {
    const teardown = vi.fn();
    const source$ = new Observable<number>(subscriber => {
      subscriber.next(1);
      return teardown;
    });
    expect(collectReplay(source$)).toEqual([1]);
    expect(teardown).toHaveBeenCalledOnce();
  });

  test('returns independent arrays while preserving duplicate and falsy events', () => {
    const source$ = of(0, 0, 1);
    const first = collectReplay(source$);
    first.length = 0;
    expect(collectReplay(source$)).toEqual([0, 0, 1]);
    expectTypeOf(collectReplay(source$)).toEqualTypeOf<number[]>();
  });
});
