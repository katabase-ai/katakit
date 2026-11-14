import { expect, test, vi } from 'vitest';
import { makeKatakit } from './katakit';
import { makeKatakitPlugin } from './plugin';

test('effects and repeated lookups share one method collection per runtime', () => {
  const seen: unknown[] = [];
  const makeMethods = vi.fn(() => {
    let count = 0;
    return { increment: () => ++count };
  });
  const plugin = makeKatakitPlugin({
    type: 'Counter',
    configure: () => ({}),
    methods: makeMethods,
    effects: ({ methods }) => {
      seen.push(methods);
      return [];
    },
  });
  const runtime = makeKatakit({ plugins: [plugin.configure({})] }).start();
  const first = runtime.getMethods(plugin);
  const second = runtime.getMethods(plugin);

  expect(first).toBe(second);
  expect(seen).toEqual([first]);
  expect(makeMethods).toHaveBeenCalledOnce();
  expect(first.increment()).toBe(1);
  expect(second.increment()).toBe(2);
});

test('method-owned resources remain isolated when runtimes reuse a configured plugin', () => {
  const plugin = makeKatakitPlugin({
    type: 'Counter',
    configure: () => ({}),
    methods: () => {
      let count = 0;
      return { increment: () => ++count };
    },
  });
  const configured = plugin.configure({});
  const first = makeKatakit({ plugins: [configured] }).start();
  const second = makeKatakit({ plugins: [configured] }).start();

  expect(first.getMethods(plugin)).not.toBe(second.getMethods(plugin));
  expect(first.getMethods(plugin).increment()).toBe(1);
  expect(second.getMethods(plugin).increment()).toBe(1);
});
