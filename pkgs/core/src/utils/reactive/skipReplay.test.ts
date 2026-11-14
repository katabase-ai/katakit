import { Observable, of, ReplaySubject, Subject } from 'rxjs';
import { expect, expectTypeOf, test, vi } from 'vitest';
import { skipReplay } from './skipReplay';

test('skips existing history but forwards every subsequent event, including duplicate values', () => {
  const source$ = new ReplaySubject<number>();
  source$.next(1);
  source$.next(2);
  const seen: number[] = [];
  const subscription = source$.pipe(skipReplay()).subscribe(value => seen.push(value));

  try {
    expect(seen).toEqual([]);
    source$.next(2);
    source$.next(3);
    expect(seen).toEqual([2, 3]);
  } finally {
    subscription.unsubscribe();
  }
});

test('each subscription has its own replay boundary even when it shares the operator', () => {
  const source$ = new ReplaySubject<number>();
  const live$ = source$.pipe(skipReplay());
  const first: number[] = [];
  const second: number[] = [];
  const firstSubscription = live$.subscribe(value => first.push(value));
  source$.next(1);
  const secondSubscription = live$.subscribe(value => second.push(value));

  try {
    source$.next(2);
    expect(first).toEqual([1, 2]);
    expect(second).toEqual([2]);
  } finally {
    firstSubscription.unsubscribe();
    secondSubscription.unsubscribe();
  }
});

test('the documented boundary is synchronous subscription, not value identity or source type', () => {
  const seen: number[] = [];
  let emit: ((value: number) => void) | undefined;
  const source$ = new Observable<number>(subscriber => {
    subscriber.next(1);
    emit = value => subscriber.next(value);
  });
  const subscription = source$.pipe(skipReplay()).subscribe(value => seen.push(value));

  try {
    emit?.(1);
    expect(seen).toEqual([1]);
  } finally {
    subscription.unsubscribe();
  }
});

test('forwards synchronous completion after skipping all synchronous values', () => {
  const next = vi.fn();
  const complete = vi.fn();
  of(1, 2).pipe(skipReplay()).subscribe({ next, complete });
  expect(next).not.toHaveBeenCalled();
  expect(complete).toHaveBeenCalledOnce();
});

test('forwards replay and live errors with the original error identity', () => {
  const failure = new Error('Source failed');
  const replay$ = new ReplaySubject<number>();
  replay$.next(1);
  replay$.error(failure);
  const replayError = vi.fn();
  replay$.pipe(skipReplay()).subscribe({ error: replayError });
  expect(replayError).toHaveBeenCalledExactlyOnceWith(failure);
  expect(replayError.mock.calls[0]?.[0]).toBe(failure);

  const live$ = new Subject<number>();
  const liveError = vi.fn();
  live$.pipe(skipReplay()).subscribe({ error: liveError });
  live$.error(failure);
  expect(liveError).toHaveBeenCalledExactlyOnceWith(failure);
  expect(liveError.mock.calls[0]?.[0]).toBe(failure);
});

test('downstream unsubscription releases the upstream subscription', () => {
  const teardown = vi.fn();
  const source$ = new Observable<number>(() => teardown);
  const subscription = source$.pipe(skipReplay()).subscribe();
  expect(teardown).not.toHaveBeenCalled();
  subscription.unsubscribe();
  expect(teardown).toHaveBeenCalledOnce();
});

test('preserves the event type', () => {
  const live$ = new Subject<{ message: string }>().pipe(skipReplay());
  expectTypeOf(live$).toEqualTypeOf<Observable<{ message: string }>>();
});
