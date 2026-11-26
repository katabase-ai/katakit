import { useMemo, useRef } from 'react';

type Noop = (this: any, ...args: any[]) => any;

type PickFunction<T extends Noop> = (
  this: ThisParameterType<T>,
  ...args: Parameters<T>
) => ReturnType<T>;

export const useStableFn = <T extends Noop>(fn: T) => {
  const fnRef = useRef<T>(fn);

  // why not write `fnRef.current = fn`?
  // https://github.com/alibaba/hooks/issues/728
  fnRef.current = useMemo<T>(() => fn, [fn]);

  const stableFn = useRef<PickFunction<T>>(undefined);

  if (!stableFn.current) {
    stableFn.current = function (this, ...args) {
      return fnRef.current.apply(this, args);
    };
  }

  return stableFn.current;
};
