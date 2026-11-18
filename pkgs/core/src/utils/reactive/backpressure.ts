import { Observable } from 'rxjs';
import { eachValueFrom, latestValueFrom } from 'rxjs-for-await';

/**
 * How an effect's handler consumes values that arrive while it is busy:
 *
 * - `'latest'` -- one handler in flight; values arriving mid-run share one
 *   pending slot, so only the newest runs after the current handler. For
 *   operation runs that are fungible re-derivations of current state (most transcript
 *   effects).
 * - `'queue'` -- one handler in flight; every value is buffered and handled in
 *   FIFO order, nothing conflated. For distinct user requests that must all run
 *   (topic/slide recap request effects).
 * - `'none'` -- start a handler for every value without waiting for earlier handlers.
 */
export type BackpressureStrategy = 'latest' | 'none' | 'queue';

const backpressureLatest = async <T>(
  observable: Observable<T>,
  handler: (value: T) => Promise<void>
) => {
  for await (const value of latestValueFrom(observable)) {
    await handler(value);
  }
};

const backpressureQueue = async <T>(
  observable: Observable<T>,
  handler: (value: T) => Promise<void>
) => {
  // `eachValueFrom` buffers values that arrive while the handler is awaited,
  // so this is a lossless FIFO drain.
  for await (const value of eachValueFrom(observable)) {
    await handler(value);
  }
};

const backpressureNone = async <T>(
  observable: Observable<T>,
  handler: (value: T) => Promise<void>
) => {
  for await (const value of eachValueFrom(observable)) {
    // Don't wait for this handler before consuming the next value.
    handler(value);
  }
};

export const subscribeWithBackpressure = <T>(
  strategy: BackpressureStrategy,
  observable: Observable<T>,
  handler: (value: T) => void | Promise<void>
) => {
  const handlerWithErrorHandling = async (value: T) => {
    try {
      await handler(value);
    } catch (error) {
      console.error(error);
    }
  };

  ({
    latest: () => backpressureLatest(observable, handlerWithErrorHandling),
    queue: () => backpressureQueue(observable, handlerWithErrorHandling),
    none: () => backpressureNone(observable, handlerWithErrorHandling),
  })[strategy]();
};
