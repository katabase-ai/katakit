import { Observable, tap } from 'rxjs';

export type Delivery = {
  lane: string;
  messageNumber: number;
  time: number;
  value: unknown;
  stack: string;
};

// Stack depth in Chromium defaults to ten, often entirely inside RxJS. Scope the
// higher limit to the synchronous capture, not the lifetime of the application.
const deliveryStack = () => {
  const ctor = Error as ErrorConstructor & { stackTraceLimit?: number };
  const limit = ctor.stackTraceLimit;
  if (typeof limit !== 'number') return new Error().stack ?? '';
  try {
    ctor.stackTraceLimit = Math.max(limit, 50);
    return new Error().stack ?? '';
  } finally {
    ctor.stackTraceLimit = limit;
  }
};

const traceDeliveries = (
  source: Observable<unknown>,
  notify: (id: number, value: unknown) => void
) => {
  let messageNumber = 0;
  const traced = source.pipe(tap(value => notify(++messageNumber, value)));
  const subscribe = traced.subscribe.bind(traced);
  // Keep Subjects writable and preserve property.get(), eager.getAll(), and
  // custom accessors. RxJS composition must subscribe through the decorated view.
  return new Proxy(source, {
    get(target, key) {
      if (key === 'subscribe') return subscribe;
      const member = Reflect.get(target, key, target);
      if (typeof member !== 'function' || key in Observable.prototype || key === 'asObservable')
        return member;
      return member.bind(target);
    },
  });
};

export const installRecorder = (onDelivery: (delivery: Delivery) => void) => {
  const hook = Symbol.for('katakit.devtools.observables.v1');
  if (Reflect.has(globalThis, hook)) throw new Error('Katakit devtools is already open');
  let record: typeof onDelivery | undefined = onDelivery;
  const runtimes = new WeakMap<object, number>();
  let count = 0;
  const inspect = (
    runtime: object,
    plugin: string,
    streams: Record<string, Observable<unknown>>
  ) => {
    const runtimeId = runtimes.get(runtime) ?? ++count;
    runtimes.set(runtime, runtimeId);
    return Object.fromEntries(
      Object.entries(streams).map(([name, stream]) => {
        const lane = `#${runtimeId} ${plugin}.${name}`;
        return [
          name,
          traceDeliveries(stream, (messageNumber, value) => {
            // Diagnostics must not turn a successful delivery into a stream error.
            try {
              record?.({
                lane,
                messageNumber,
                time: performance.now(),
                value,
                stack: deliveryStack(),
              });
            } catch {
              /* The host may disallow stack access. */
            }
          }),
        ];
      })
    );
  };
  Reflect.set(globalThis, hook, inspect);
  return () => {
    record = undefined;
    if (Reflect.get(globalThis, hook) === inspect) Reflect.deleteProperty(globalThis, hook);
  };
};
