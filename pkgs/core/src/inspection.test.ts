import { Subject } from 'rxjs';
import { expect, test, vi } from 'vitest';
import { makeKatakit, makeKatakitPlugin, makeEffect } from './index';

test('inspection enumerates the already constructed runtime without invoking factories or handlers again', () => {
  const source$ = new Subject<number>();
  const handler = vi.fn();
  const observables = vi.fn(() => ({ source$ }));
  const methods = vi.fn(() => ({ run: handler }));
  const effects = vi.fn(() => [
    makeEffect({ name: 'consume', on: source$, backpressure: 'queue', handler }),
  ]);
  const plugin = makeKatakitPlugin({
    type: 'Test',
    configure: () => ({}),
    observables,
    methods,
    effects,
  });
  const runtime = makeKatakit({ plugins: [plugin.configure({})], tracer: false }).start();
  const first = runtime.inspect();
  const second = runtime.inspect();
  expect(first).toEqual(second);
  expect(first.tracing).toBe(false);
  expect(first.plugins[0]?.observables).toBe(runtime.getObservables(plugin));
  expect(first.plugins[0]?.methods).toEqual(['run']);
  expect(first.plugins[0]?.effects).toEqual([{ name: 'consume', index: 0, backpressure: 'queue' }]);
  expect(observables).toHaveBeenCalledOnce();
  expect(methods).toHaveBeenCalledOnce();
  expect(effects).toHaveBeenCalledOnce();
  expect(handler).not.toHaveBeenCalled();
  first.plugins[0]!.effects[0]!.name = 'changed';
  expect(runtime.inspect().plugins[0]?.effects[0]?.name).toBe('consume');
  source$.complete();
});
