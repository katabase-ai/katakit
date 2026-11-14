import { of, ReplaySubject, Subject } from 'rxjs';
import { describe, expect, test } from 'vitest';
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
