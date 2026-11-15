import { useSyncExternalStore } from 'react';
import type { Observable } from 'rxjs';

/** Bridge a Katakit observable with a synchronous current value to React. */
export const useKatakitObservable = <T>(observable: Observable<T> & { get: () => T }): T =>
  useSyncExternalStore(
    onChange => {
      const subscription = observable.subscribe(() => onChange());
      return () => subscription.unsubscribe();
    },
    () => observable.get(),
    () => observable.get()
  );
