import { Observable, Subject } from 'rxjs';
import { makeKatakitPlugin } from '../../plugin';

export const KatakitLifecyclePlugin = makeKatakitPlugin({
  type: 'KatakitLifecycle',
  configure: (_opts: {}) => ({}),
  observables: () => ({
    start$: new Subject<void>() as Observable<void>,
    stop$: new Subject<void>() as Observable<void>,
  }),
  methods: ({ observables }) => ({
    start: () => {
      (observables.start$ as Subject<void>).next();
    },
    stop: () => {
      (observables.stop$ as Subject<void>).next();
    },
  }),
});
