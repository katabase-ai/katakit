/** Promise.withResolvers equivalent for ES2022 application runtimes. */
export const deferred = <T>() => {
  let accept!: (value: T | PromiseLike<T>) => void;
  let fail!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    accept = resolve;
    fail = reject;
  });
  return { promise, resolve: accept, reject: fail };
};
