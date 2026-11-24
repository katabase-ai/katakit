// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { localInferenceConnection, useLocalInference } from './localInference';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const config = { enabled: true, model: 'server/model', maxBodyBytes: 65536, maxOutputTokens: 2048 };
const Status = ({ enabled }: { enabled: boolean }) => (
  <p>{useLocalInference(enabled) ? 'Connected' : 'Unavailable'}</p>
);

test('the browser connection forwards cancellation and transcript JSON, never a provider credential', async () => {
  const request = vi.fn<typeof fetch>(async () => Response.json({ choices: [] }));
  const parent = new AbortController();
  const child = new AbortController();
  const connection = await localInferenceConnection(
    config,
    request
  )({ signal: parent.signal, verification: document.createElement('div'), onAllowance: vi.fn() });
  expect(request).not.toHaveBeenCalled();
  await connection.requestCompletion({ body: '{"messages":[]}', signal: child.signal });
  expect(request.mock.calls[0]![0]).toBe('/__gallery_inference/completion');
  expect(request.mock.calls[0]![1]!.headers).toEqual({ 'Content-Type': 'application/json' });
  const signal = request.mock.calls[0]![1]!.signal!;
  parent.abort();
  expect(signal.aborted).toBe(true);
});

test('public mode does not even discover the local developer key; switching back drops the connection', async () => {
  const request = vi.fn<typeof fetch>(async () => Response.json(config));
  vi.stubGlobal('fetch', request);
  const view = render(<Status enabled={false} />);
  expect(request).not.toHaveBeenCalled();
  view.rerender(<Status enabled />);
  await screen.findByText('Connected');
  expect(request).toHaveBeenCalledOnce();
  expect(String(request.mock.calls[0]![0])).toBe('/__gallery_inference/status');
  view.rerender(<Status enabled={false} />);
  expect(screen.getByText('Unavailable')).toBeDefined();
  expect(request).toHaveBeenCalledOnce();
});

test('late capability responses cannot reconnect a mode that has been disabled', async () => {
  let finish!: (response: Response) => void;
  const request = vi.fn<typeof fetch>(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  vi.stubGlobal('fetch', request);
  const view = render(<Status enabled />);
  view.rerender(<Status enabled={false} />);
  await act(async () => finish(Response.json(config)));
  expect(screen.getByText('Unavailable')).toBeDefined();
});
