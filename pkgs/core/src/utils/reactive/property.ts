import { Observable } from 'rxjs';
import { InferObservableValue } from './observable';
import { assert } from '../assert';

/**
 * Wraps an RxJS Observable and tracks its latest value.
 * Note, this should be used with a ReplaySubject.
 *
 * Can return undefined if the observable hasn't emitted a value yet.
 *
 * TODO: what about cleanup? can it be done wholesale? maybe with an AbortSignal?
 */
export const optionalProperty = <T extends Observable<unknown>>(observable: T) => {
  let value: InferObservableValue<T> | undefined = undefined;
  let failure: { error: unknown } | undefined;
  observable.subscribe({
    next: v => {
      value = v as InferObservableValue<T>;
    },
    error: error => {
      failure = { error };
    },
  });

  // Surface replay failures to the caller; later failures invalidate the cached
  // value so a synchronous read cannot return incomplete derived state.
  if (failure) throw failure.error;

  return Object.assign(observable, {
    get: () => {
      if (failure) throw failure.error;
      return value;
    },
  }) as WithOptionalProperty<T>;
};

export type WithOptionalProperty<T extends Observable<unknown>> = T & {
  get: () => InferObservableValue<T> | undefined;
};

/**
 * Wraps an RxJS Observable and tracks its latest value.
 * Note, this should be used with a ReplaySubject.
 *
 * Throws if the observable doesn't emit a value synchronously.
 *
 * TODO: what about cleanup? can it be done wholesale? maybe with an AbortSignal?
 */
export const property = <T extends Observable<unknown>>(observable: T) => {
  const opt = optionalProperty(observable);
  // Capture the optional `get` before `Object.assign` overrides it on `opt`,
  // otherwise the new `get` would recursively call itself.
  const getOptional = opt.get;

  assert(getOptional() !== undefined, 'Property is inited as undefined');

  return Object.assign(opt, {
    get: () => getOptional()!,
  }) as WithProperty<T>;
};

export type WithProperty<T extends Observable<unknown>> = T & {
  get: () => InferObservableValue<T>;
};
