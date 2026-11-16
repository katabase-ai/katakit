import { context } from '@opentelemetry/api';
import { StackContextManager, TracerProvider } from '@opentelemetry/sdk-trace';
import { makeKatakit, makeKatakitPlugin } from '@katakit/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { afterEach, expect, test } from 'vitest';
import { createDevToolsStore, observableKey } from './store';

afterEach(() => context.disable());

test('bounds history, isolates tracer scopes, and never resurrects cleared or evicted running spans', async () => {
  const store = createDevToolsStore({ capacity: 2, scopeName: 'wanted' });
  const provider = new TracerProvider({ spanProcessors: [store.spanProcessor] });
  const tracer = provider.getTracer('wanted');
  const attributes = {
    'katakit.plugin.type': 'Test',
    'katakit.invocation.kind': 'method',
    'katakit.method.name': 'run',
  };
  const unrelated = provider.getTracer('unrelated').startSpan('ignored', { attributes });
  unrelated.end();
  expect(store.getSnapshot().activity).toHaveLength(0);
  const first = tracer.startSpan('first', { attributes });
  tracer.startSpan('second', { attributes }).end();
  tracer.startSpan('third', { attributes }).end();
  expect(store.getSnapshot().omitted).toBe(1);
  first.end();
  expect(store.getSnapshot().activity).toHaveLength(2);
  const pending = tracer.startSpan('pending', { attributes });
  store.clear();
  pending.end();
  expect(store.getSnapshot().activity).toHaveLength(0);
  expect(store.getSnapshot().omitted).toBe(0);
  await provider.shutdown();
});

test('captures current values, emissions and active span links without resetting application state', async () => {
  context.setGlobalContextManager(new StackContextManager().enable());
  const store = createDevToolsStore();
  const provider = new TracerProvider({ spanProcessors: [store.spanProcessor] });
  const value$ = new BehaviorSubject({ count: 0 });
  const plugin = makeKatakitPlugin({
    type: 'Test',
    configure: () => ({}),
    observables: () => ({ value$ }),
    methods: () => ({ set: (count: number) => value$.next({ count }) }),
  });
  const runtime = makeKatakit({
    plugins: [plugin.configure({})],
    tracer: provider.getTracer('test'),
  }).start();
  const disconnect = store.connect(runtime);
  runtime.getMethods(plugin).set(1);
  const emission = store
    .getSnapshot()
    .activity.find(entry => entry.kind === 'emission' && entry.value?.includes('1'))!;
  const method = store.getSnapshot().activity.find(entry => entry.kind === 'method')!;
  expect(emission.parentSpanId).toBe(method.spanId);
  expect(emission.traceId).toBe(method.traceId);
  store.clear();
  expect(value$.value.count).toBe(1);
  expect(store.getSnapshot().values[observableKey('Test', 'value$')]?.value).toContain('1');
  disconnect();
  expect(value$.observed).toBe(false);
  const reconnect = store.connect(runtime);
  disconnect(); // Stale cleanup must not detach or invalidate the new connection.
  expect(() => store.connect(runtime)).toThrow('already connected');
  expect(value$.observed).toBe(true);
  reconnect();
  await provider.shutdown();
});

test('reports observable errors and releases subscribers', () => {
  const store = createDevToolsStore();
  const source$ = new Subject<number>();
  const plugin = makeKatakitPlugin({
    type: 'Broken',
    configure: () => ({}),
    observables: () => ({ source$ }),
  });
  const runtime = makeKatakit({ plugins: [plugin.configure({})], tracer: false }).start();
  const disconnect = store.connect(runtime);
  source$.error(new Error('Source failed'));
  expect(store.getSnapshot().values[observableKey('Broken', 'source$')]).toEqual({
    status: 'failed',
    value: expect.stringContaining('Source failed'),
  });
  disconnect();
  expect(source$.observed).toBe(false);
});
