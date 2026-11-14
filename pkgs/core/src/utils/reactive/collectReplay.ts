import { Observable } from 'rxjs';
import { InferObservableValue } from './observable';

/**
 * Gets an array of all the values emitted synchronously and immediately from an Observable.
 * This means that this returns the whole replay up to this point of a ReplaySubject,
 * and for a completed ReplaySubject, it returns all values (same as toArray).
 */
export const collectReplay = <TObservable extends Observable<unknown>>(observable: TObservable) => {
  const values: InferObservableValue<TObservable>[] = [];
  const subscription = observable.subscribe(value => {
    values.push(value as InferObservableValue<TObservable>);
  });
  subscription.unsubscribe();
  return values;
};
