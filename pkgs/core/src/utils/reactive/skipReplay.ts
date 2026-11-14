import { Observable, OperatorFunction } from 'rxjs';

/**
 * Skips the replay buffer of the observable.
 * This is useful when you want to subscribe to an observable that has a replay buffer,
 * but you don't want to receive the replayed values.
 *
 * Example: An event log that you want to subscribe to but only
 * listen to the values from that point in time, and ignore the historical values.
 *
 * Note: This function actually doesn't just skip replay, it simply skips any messages
 * that happened *immediately* when subscribed. Replay is a subset of that.
 */
export const skipReplay = <T>(): OperatorFunction<T, T> => {
  return (observable: Observable<T>) =>
    new Observable<T>(subscriber => {
      let inReplay = true;
      const subscription = observable.subscribe({
        next: value => {
          if (inReplay) {
            return;
          }
          subscriber.next(value);
        },
        error: error => subscriber.error(error),
        complete: () => subscriber.complete(),
      });
      // replay happens synchronously and immediately when subscribed.
      // so after the subscription, we know all events have been replayed.
      inReplay = false;
      return subscription;
    });
};
