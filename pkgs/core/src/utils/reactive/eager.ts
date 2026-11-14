import { Observable, shareReplay, tap } from 'rxjs';
import { InferObservableValue } from './observable';

/**
 * Memoizes an observable by eagerly calculating all its values,
 * so that downstream subscription and derived observables are free.
 *
 * This is similar to RxJS's `shareReplay` operator with bufferSize=Infinity,
 * but it also stores the values in a separate array, so that it can be accessed by non-reactive code.
 *
 * TODO: what about cleanup? can it be done wholesale? maybe with an AbortSignal?
 */
export const eager = <TObservable extends Observable<unknown>>(
  observable: TObservable
): WithEager<TObservable> => {
  const values: InferObservableValue<TObservable>[] = [];
  let failure: { error: unknown } | undefined;

  // share the observable so that all downstream subscriptions don't have to recalculate
  // the upstream stream derivations
  const shared$ = observable.pipe(
    tap(val => {
      // CAUTION: the array is mutable for perf.
      // It must be cloned before getting
      values.push(val as InferObservableValue<TObservable>);
    }),
    shareReplay({ bufferSize: Infinity, refCount: true })
  );

  // subscribe eagerly so that the array gets filled even if there's
  // no downstream subscriptions.
  shared$.subscribe({
    error: error => {
      failure = { error };
    },
  });

  // Replay errors must reach the constructing caller's catch, rather than RxJS's
  // asynchronous unhandled-error timer (which terminates the backend process).
  if (failure) throw failure.error;

  return Object.assign(shared$, {
    getAll: () => {
      if (failure) throw failure.error;
      return [...values];
    },
  }) as WithEager<TObservable>;
};

export type WithEager<TObservable extends Observable<unknown>> = TObservable & {
  getAll: () => InferObservableValue<TObservable>[];
};
