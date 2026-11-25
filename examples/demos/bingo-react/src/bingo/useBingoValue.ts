import { useCallback, useSyncExternalStore } from 'react';
import type { Observable } from 'rxjs';

/** Read the active round immediately when a host replaces its runtime. */
export const useBingoValue = <T>(property: Observable<T> & { get: () => T }) =>
  useSyncExternalStore(
    useCallback(
      (notify: () => void) => {
        const subscription = property.subscribe(notify);
        return () => subscription.unsubscribe();
      },
      [property]
    ),
    property.get
  );
