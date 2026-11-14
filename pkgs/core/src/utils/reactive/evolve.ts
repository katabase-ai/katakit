import { Observable, OperatorFunction } from 'rxjs';

/**
 * Same as RxJS's `scan` operator, but with sharper typing for the common
 * "fold a stream of events into accumulated state" pattern, where the seed
 * type (e.g. `undefined`) is distinct from the accumulated state type.
 *
 * The evolver sees `acc: TInitial | T` so it can branch on the seeded vs.
 * already-evolved case, and the resulting observable is typed as
 * `Observable<T>` directly -- no `as Observable<T>` cast needed at the call
 * site, the way `scan`'s overloads force.
 *
 * Like `scan`, the seed is never emitted; only evolver outputs are.
 */
export const evolve =
  <TInitial, TCur, T>(
    evolver: (acc: TInitial, cur: TCur) => T,
    initialState: TInitial
  ): OperatorFunction<TCur, T> =>
  source =>
    new Observable<T>(subscriber => {
      let acc: any = initialState;
      return source.subscribe({
        next: cur => {
          try {
            acc = evolver(acc, cur);
          } catch (error) {
            subscriber.error(error);
            return;
          }
          subscriber.next(acc);
        },
        error: error => subscriber.error(error),
        complete: () => subscriber.complete(),
      });
    });
