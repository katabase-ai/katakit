import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  StackContextManager,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { makeEffect } from './effect';
import { makeKatakit } from './katakit';
import { makeKatakitPlugin } from './plugin';

const setupTelemetry = () => {
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  const exporter = new InMemorySpanExporter();
  const processor = new SimpleSpanProcessor({ exporter });
  const started = vi.spyOn(processor, 'onStart');
  const provider = new TracerProvider({ spanProcessors: [processor] });
  trace.setGlobalTracerProvider(provider);
  return { exporter, provider, started };
};

let telemetry: ReturnType<typeof setupTelemetry>;
beforeEach(() => {
  telemetry = setupTelemetry();
});
afterEach(async () => {
  await telemetry.provider.shutdown();
  context.disable();
  trace.disable();
  vi.restoreAllMocks();
});

const finished = async () => {
  await telemetry.provider.forceFlush();
  return telemetry.exporter.getFinishedSpans();
};

test('records methods that emit no state change using the global library tracer', async () => {
  const plugin = makeKatakitPlugin({
    type: 'Counter',
    configure: () => ({}),
    methods: () => Object.freeze({ read: () => 42 }),
  });
  const runtime = makeKatakit({ plugins: [plugin.configure({})] }).start();
  const methods = runtime.getMethods(plugin);
  expect(methods).toBe(runtime.getMethods(plugin));
  expect(methods.read).toBe(runtime.getMethods(plugin).read);
  expect(methods.read()).toBe(42);

  const [span] = await finished();
  expect(span?.name).toBe('Counter.method.read');
  expect(span?.instrumentationScope.name).toBe('@katakit/core');
  expect(span?.attributes).toEqual({
    'katakit.plugin.type': 'Counter',
    'katakit.invocation.kind': 'method',
    'katakit.method.name': 'read',
  });
  expect(span?.status.code).toBe(SpanStatusCode.UNSET);
  expect(span?.ended).toBe(true);
});

test('preserves synchronous results and the invocation receiver', () => {
  const result = {};
  const plugin = makeKatakitPlugin({
    type: 'Receiver',
    configure: () => ({}),
    methods: () => ({
      read(this: { value: unknown }) {
        return this.value;
      },
      result: () => result,
    }),
  });
  const methods = makeKatakit({ plugins: [plugin.configure({})] })
    .start()
    .getMethods(plugin);
  expect(methods.read.call({ value: 12 })).toBe(12);
  expect(methods.result()).toBe(result);
});

test('preserves a returned Promise and ends its span only after settlement', async () => {
  const pending = Promise.withResolvers<number>();
  const plugin = makeKatakitPlugin({
    type: 'Async',
    configure: () => ({}),
    methods: () => ({ run: () => pending.promise }),
  });
  const methods = makeKatakit({ plugins: [plugin.configure({})] })
    .start()
    .getMethods(plugin);
  expect(methods.run()).toBe(pending.promise);
  expect(telemetry.started).toHaveBeenCalledOnce();
  expect(await finished()).toEqual([]);
  pending.resolve(7);
  await expect(pending.promise).resolves.toBe(7);
  expect((await finished()).map(span => span.name)).toEqual(['Async.method.run']);
});

test('records failures without changing thrown values or exporting application payloads', async () => {
  const error = new TypeError('private error detail');
  const plugin = makeKatakitPlugin({
    type: 'Failure',
    configure: () => ({}),
    methods: () => ({
      sync: (_payload: unknown) => {
        throw error;
      },
      async: () => Promise.reject(error),
      nonError: () => Promise.reject('private rejection'),
    }),
  });
  const methods = makeKatakit({ plugins: [plugin.configure({})] })
    .start()
    .getMethods(plugin);
  expect(() => methods.sync('private argument')).toThrow(error);
  await expect(methods.async()).rejects.toBe(error);
  await expect(methods.nonError()).rejects.toBe('private rejection');
  const spans = await finished();
  expect(spans.map(span => span.status.code)).toEqual(Array(3).fill(SpanStatusCode.ERROR));
  expect(spans.map(span => span.attributes['error.type'])).toEqual([
    'TypeError',
    'TypeError',
    'string',
  ]);
  expect(spans.every(span => span.events.length === 0)).toBe(true);
  expect(
    JSON.stringify(
      spans.map(({ name, attributes, status, events }) => ({ name, attributes, status, events }))
    )
  ).not.toContain('private');
});

test('supports a per-runtime tracer and a complete instrumentation opt-out', async () => {
  const methods = Object.freeze({ read: () => 1 });
  const plugin = makeKatakitPlugin({
    type: 'Custom',
    configure: () => ({}),
    methods: () => methods,
  });
  const traced = makeKatakit({
    plugins: [plugin.configure({})],
    tracer: telemetry.provider.getTracer('custom'),
  }).start();
  const disabled = makeKatakit({ plugins: [plugin.configure({})], tracer: false }).start();
  expect(disabled.getMethods(plugin)).toBe(methods);
  disabled.getMethods(plugin).read();
  traced.getMethods(plugin).read();
  expect((await finished()).map(span => span.instrumentationScope.name)).toEqual(['custom']);
});

test('a runtime created before SDK registration picks up the host provider later', async () => {
  trace.disable();
  const plugin = makeKatakitPlugin({
    type: 'LateSdk',
    configure: () => ({}),
    methods: () => ({ read: () => 1 }),
  });
  const methods = makeKatakit({ plugins: [plugin.configure({})] })
    .start()
    .getMethods(plugin);
  methods.read();
  expect(await finished()).toEqual([]);
  trace.setGlobalTracerProvider(telemetry.provider);
  methods.read();
  expect((await finished()).map(span => span.name)).toEqual(['LateSdk.method.read']);
});

test('works without a registered SDK and does not start work during inspection', async () => {
  trace.disable();
  const input$ = new Subject<number>();
  const handler = vi.fn();
  const plugin = makeKatakitPlugin({
    type: 'NoSdk',
    configure: () => ({}),
    observables: () => ({ input$ }),
    methods: () => ({ read: () => 7 }),
    effects: () => [makeEffect({ on: input$, backpressure: 'queue', handler })],
  });
  const kit = makeKatakit({ plugins: [plugin.configure({})] });
  kit.getObservables(plugin);
  input$.next(1);
  expect(handler).not.toHaveBeenCalled();
  const runtime = kit.start();
  expect(runtime.getMethods(plugin).read()).toBe(7);
  input$.next(2);
  await vi.waitFor(() => expect(handler).toHaveBeenCalledExactlyOnceWith(2));
  expect(await finished()).toEqual([]);
  input$.complete();
});

test.each(['queue'] as const)(
  '%s preserves the triggering context through backpressure',
  async strategy => {
    const input$ = new Subject<number>();
    const firstStarted = Promise.withResolvers<void>();
    const releaseFirst = Promise.withResolvers<void>();
    const done = Promise.withResolvers<void>();
    const received: number[] = [];
    const producer = makeKatakitPlugin({
      type: 'Producer',
      configure: () => ({}),
      methods: () => ({ publish: (value: number) => input$.next(value) }),
    });
    const consumer = makeKatakitPlugin({
      type: 'Consumer',
      configure: () => ({}),
      methods: () => ({ record: (value: number) => received.push(value) }),
      effects: ({ methods }) => [
        makeEffect({
          name: 'consume',
          on: input$,
          backpressure: strategy,
          handler: async value => {
            if (value === 1) {
              firstStarted.resolve();
              await releaseFirst.promise;
            }
            methods.record(value);
            if (value === 3) done.resolve();
          },
        }),
      ],
    });
    const runtime = makeKatakit({
      plugins: [producer.configure({}), consumer.configure({})],
    }).start();
    const publish = runtime.getMethods(producer).publish;
    try {
      publish(1);
      await firstStarted.promise;
      publish(2);
      publish(3);
      // No span claims the pending handlers have started while the first is blocked.
      expect(
        telemetry.started.mock.calls.filter(([span]) => span.name === 'Consumer.effect.consume')
      ).toHaveLength(1);
      releaseFirst.resolve();
      await done.promise;
      await vi.waitFor(() =>
        expect(
          telemetry.exporter
            .getFinishedSpans()
            .filter(span => span.name === 'Consumer.effect.consume')
        ).toHaveLength(3)
      );
      expect(received).toEqual([1, 2, 3]);

      const spans = await finished();
      const producers = spans.filter(span => span.name === 'Producer.method.publish');
      const effects = spans.filter(span => span.name === 'Consumer.effect.consume');
      expect(effects.map(span => span.parentSpanContext?.spanId)).toEqual(
        producers.map(span => span.spanContext().spanId)
      );
      for (const effect of effects) {
        const child = spans.find(
          span =>
            span.name === 'Consumer.method.record' &&
            span.parentSpanContext?.spanId === effect.spanContext().spanId
        );
        expect(child?.spanContext().traceId).toBe(effect.spanContext().traceId);
        expect(effect.attributes['katakit.effect.backpressure']).toBe(strategy);
      }
    } finally {
      releaseFirst.resolve();
      input$.complete();
    }
  }
);

test("latest traces only the selected burst value with that value's producer context", async () => {
  const input$ = new Subject<number>();
  const received: number[] = [];
  const plugin = makeKatakitPlugin({
    type: 'Latest',
    configure: () => ({}),
    methods: () => ({ publish: (value: number) => input$.next(value) }),
    effects: () => [
      makeEffect({
        name: 'consume',
        on: input$,
        backpressure: 'latest',
        handler: value => {
          received.push(value);
        },
      }),
    ],
  });
  const runtime = makeKatakit({ plugins: [plugin.configure({})] }).start();
  const { publish } = runtime.getMethods(plugin);
  publish(1);
  publish(2);
  publish(3);
  await vi.waitFor(() => expect(received).toEqual([3]));
  const spans = await finished();
  const producers = spans.filter(span => span.name === 'Latest.method.publish');
  const effects = spans.filter(span => span.name === 'Latest.effect.consume');
  expect(effects).toHaveLength(1);
  expect(effects[0]?.parentSpanContext?.spanId).toBe(producers[2]?.spanContext().spanId);
  input$.complete();
});

test('concurrent effects retain independent parents across interleaved awaits', async () => {
  const input$ = new Subject<number>();
  const gates = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const started = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const recorded: number[] = [];
  const producer = makeKatakitPlugin({
    type: 'Producer',
    configure: () => ({}),
    methods: () => ({ publish: (value: number) => input$.next(value) }),
  });
  const consumer = makeKatakitPlugin({
    type: 'Consumer',
    configure: () => ({}),
    methods: () => ({ record: (value: number) => recorded.push(value) }),
    effects: ({ methods }) => [
      makeEffect({
        on: input$,
        backpressure: 'concurrent',
        handler: async value => {
          started[value]!.resolve();
          await gates[value]!.promise;
          methods.record(value);
        },
      }),
    ],
  });
  const runtime = makeKatakit({
    plugins: [producer.configure({}), consumer.configure({})],
  }).start();
  try {
    runtime.getMethods(producer).publish(0);
    runtime.getMethods(producer).publish(1);
    await Promise.all(started.map(gate => gate.promise));
    gates[1]!.resolve();
    await vi.waitFor(() => expect(recorded).toEqual([1]));
    gates[0]!.resolve();
    await vi.waitFor(() => expect(telemetry.exporter.getFinishedSpans()).toHaveLength(6));
    expect(recorded).toEqual([1, 0]);
    const spans = await finished();
    const producers = spans.filter(span => span.name === 'Producer.method.publish');
    const effects = spans.filter(span => span.name === 'Consumer.effect.0');
    expect(effects.map(span => span.parentSpanContext?.spanId)).toEqual(
      producers.toReversed().map(span => span.spanContext().spanId)
    );
    for (const effect of effects) {
      expect(effect.attributes['katakit.effect.index']).toBe(0);
      expect(
        spans.some(
          span =>
            span.name === 'Consumer.method.record' &&
            span.parentSpanContext?.spanId === effect.spanContext().spanId
        )
      ).toBe(true);
    }
  } finally {
    gates.forEach(gate => gate.resolve());
    input$.complete();
  }
});

test('effect failures end spans before the existing error handler logs them and processing continues', async () => {
  const error = new Error('handler failed');
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  const input$ = new Subject<number>();
  const handled = vi.fn();
  const plugin = makeKatakitPlugin({
    type: 'FailingEffect',
    configure: () => ({}),
    methods: () => ({ publish: (value: number) => input$.next(value) }),
    effects: () => [
      makeEffect({
        name: 'consume',
        on: input$,
        backpressure: 'queue',
        handler: async value => {
          if (value === 1) throw error;
          handled(value);
        },
      }),
    ],
  });
  const runtime = makeKatakit({ plugins: [plugin.configure({})] }).start();
  runtime.getMethods(plugin).publish(1);
  runtime.getMethods(plugin).publish(2);
  await vi.waitFor(() => expect(handled).toHaveBeenCalledExactlyOnceWith(2));
  expect(logged).toHaveBeenCalledExactlyOnceWith(error);
  const spans = (await finished()).filter(span => span.name === 'FailingEffect.effect.consume');
  expect(spans.map(span => span.status.code)).toEqual([SpanStatusCode.ERROR, SpanStatusCode.UNSET]);
  input$.complete();
});

test('captures reactive parentage with a synchronous context manager as well', async () => {
  // Browser hosts can use a synchronous manager; it cannot propagate native async/await.
  context.disable();
  context.setGlobalContextManager(new StackContextManager().enable());
  const input$ = new Subject<number>();
  const plugin = makeKatakitPlugin({
    type: 'SyncContext',
    configure: () => ({}),
    methods: () => ({ publish: () => input$.next(1), record: () => {} }),
    effects: ({ methods }) => [
      makeEffect({
        on: input$,
        backpressure: 'queue',
        handler: () => methods.record(),
      }),
    ],
  });
  const runtime = makeKatakit({ plugins: [plugin.configure({})] }).start();
  runtime.getMethods(plugin).publish();
  await vi.waitFor(() => expect(telemetry.exporter.getFinishedSpans()).toHaveLength(3));
  const spans = await finished();
  const producer = spans.find(span => span.name === 'SyncContext.method.publish')!;
  const effect = spans.find(span => span.name === 'SyncContext.effect.0')!;
  const method = spans.find(span => span.name === 'SyncContext.method.record')!;
  expect(effect.parentSpanContext?.spanId).toBe(producer.spanContext().spanId);
  expect(method.parentSpanContext?.spanId).toBe(effect.spanContext().spanId);
  input$.complete();
});

test('disabling instrumentation also leaves effect execution untraced', async () => {
  const input$ = new Subject<number>();
  const handled = vi.fn();
  const plugin = makeKatakitPlugin({
    type: 'Disabled',
    configure: () => ({}),
    effects: () => [makeEffect({ on: input$, backpressure: 'queue', handler: handled })],
  });
  makeKatakit({ plugins: [plugin.configure({})], tracer: false }).start();
  input$.next(1);
  await vi.waitFor(() => expect(handled).toHaveBeenCalledExactlyOnceWith(1));
  expect(await finished()).toEqual([]);
  input$.complete();
});
