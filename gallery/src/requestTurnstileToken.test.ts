// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { requestTurnstileToken } from './requestTurnstileToken';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a verified challenge removes its widget and uses the configured action', async () => {
  const remove = vi.fn();
  const render = vi.fn((_container, options) => {
    queueMicrotask(() => options.callback('synthetic-token'));
    return 'widget';
  });
  vi.stubGlobal('window', { turnstile: { render, remove } });
  const signal = new AbortController().signal;
  await expect(
    requestTurnstileToken({
      container: document.createElement('div'),
      sitekey: 'public-key',
      action: 'demo_session',
      signal,
    })
  ).resolves.toBe('synthetic-token');
  expect(render.mock.calls[0]![1]).toMatchObject({
    sitekey: 'public-key',
    action: 'demo_session',
    retry: 'never',
  });
  expect(remove).toHaveBeenCalledWith('widget');
});

test('leaving the demo cancels verification and removes the pending widget', async () => {
  const controller = new AbortController();
  const remove = vi.fn();
  vi.stubGlobal('window', { turnstile: { render: () => 'pending-widget', remove } });
  const pending = requestTurnstileToken({
    container: document.createElement('div'),
    sitekey: 'public-key',
    action: 'demo_session',
    signal: controller.signal,
  });
  controller.abort();
  await expect(pending).rejects.toThrow("We couldn't verify this browser");
  expect(remove).toHaveBeenCalledWith('pending-widget');
});
