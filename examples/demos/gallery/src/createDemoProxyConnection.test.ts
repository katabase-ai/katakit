// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createDemoProxyConnection } from './createDemoProxyConnection';
import { previewInferenceConnection } from './previewInference';
import { requestTurnstileToken } from './requestTurnstileToken';

vi.mock('./requestTurnstileToken', () => ({ requestTurnstileToken: vi.fn() }));

const origin = 'https://pr-42.katakit-preview.katabase.com';
const proxyUrl = 'https://proxy.example';
const storageKey = `katakit-demo-session:${proxyUrl}`;
const config = {
  sitekey: 'public-sitekey',
  action: 'demo_session',
  enabled: true,
  defaultModel: 'z-ai/glm-5.3',
  limits: { MAX_BODY_BYTES: 16384, MAX_OUTPUT_TOKENS: 1024, DEADLINE_MS: 60000 },
};
const session = () => ({
  expiresAt: new Date(Date.now() + 1800000).toISOString(),
  callsRemaining: 59,
  total: 60,
});
const admit = (signal = new AbortController().signal) => {
  const onAllowance = vi.fn();
  const connection = createDemoProxyConnection(proxyUrl)({
    signal,
    verification: document.createElement('div'),
    onAllowance,
  });
  return { connection, onAllowance };
};

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(requestTurnstileToken).mockReset().mockResolvedValue('synthetic-challenge');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('deployment configuration enables only the exact CI origin, independently of UI modes', () => {
  const configuration = { proxyUrl, previewOrigin: origin };
  const request = vi.fn();
  vi.stubGlobal('fetch', request);
  expect(previewInferenceConnection(configuration, origin)).toBeTypeOf('function');
  for (const other of [
    'http://localhost:4347',
    'https://katabase.com',
    'https://pr-43.katakit-preview.katabase.com',
  ])
    expect(previewInferenceConnection(configuration, other)).toBeUndefined();
  expect(previewInferenceConnection({}, origin)).toBeUndefined();
  expect(
    previewInferenceConnection({ ...configuration, proxyUrl: 'invalid' }, origin)
  ).toBeUndefined();
  expect(request).not.toHaveBeenCalled();
});

test('verification creates a session, persists its credential and reports authoritative usage', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json(config))
    .mockResolvedValueOnce(Response.json({ credential: 'synthetic-session' }))
    .mockResolvedValueOnce(Response.json(session()))
    .mockResolvedValueOnce(
      Response.json({ choices: [] }, { headers: { 'X-Demo-Session-Calls-Remaining': '58' } })
    );
  vi.stubGlobal('fetch', request);
  const { connection, onAllowance } = admit();
  const connected = await connection;
  expect(requestTurnstileToken).toHaveBeenCalledOnce();
  expect(request.mock.calls[1]![1].body).toBe(JSON.stringify({ token: 'synthetic-challenge' }));
  expect(sessionStorage.getItem(storageKey)).toBe('synthetic-session');
  expect(onAllowance).toHaveBeenLastCalledWith({ remaining: 59, total: 60 });
  await connected.requestCompletion({
    body: '{"model":"z-ai/glm-5.3"}',
    signal: new AbortController().signal,
  });
  expect(onAllowance).toHaveBeenLastCalledWith({ remaining: 58, total: 60 });
  expect(request.mock.calls[3]![1]).toMatchObject({
    credentials: 'omit',
    redirect: 'error',
    headers: { Authorization: 'Bearer synthetic-session' },
  });
});

test('reconnecting reuses the tab credential without another challenge or new allowance', async () => {
  sessionStorage.setItem(storageKey, 'saved-session');
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json(config))
    .mockResolvedValueOnce(Response.json(session()));
  vi.stubGlobal('fetch', request);
  const { connection } = admit();
  await connection;
  expect(requestTurnstileToken).not.toHaveBeenCalled();
  expect(request.mock.calls[1]![1].headers).toEqual({ Authorization: 'Bearer saved-session' });
});

test('malformed completion allowance headers never replace the authoritative session count', async () => {
  for (const remaining of ['', '-1', '0.5', '61', '1e2']) {
    sessionStorage.setItem(storageKey, 'saved-session');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(config))
        .mockResolvedValueOnce(Response.json(session()))
        .mockResolvedValueOnce(
          Response.json(
            { choices: [] },
            { headers: { 'X-Demo-Session-Calls-Remaining': remaining } }
          )
        )
    );
    const { connection, onAllowance } = admit();
    const connected = await connection;
    await connected.requestCompletion({ body: '{}', signal: new AbortController().signal });
    expect(onAllowance).toHaveBeenCalledTimes(1);
    expect(onAllowance).toHaveBeenCalledWith({ remaining: 59, total: 60 });
  }
});

test('an expired credential requires fresh verification; exhausted sessions remain exhausted', async () => {
  sessionStorage.setItem(storageKey, 'expired-session');
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json(config))
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ credential: 'replacement-session' }))
      .mockResolvedValueOnce(Response.json({ ...session(), callsRemaining: 0 }))
  );
  const { connection, onAllowance } = admit();
  await expect(connection).rejects.toMatchObject({
    policy: { terminal: true, code: 'session_allowance' },
  });
  expect(sessionStorage.getItem(storageKey)).toBe('replacement-session');
  expect(onAllowance).toHaveBeenLastCalledWith({ remaining: 0, total: 60 });
});

test('cancellation prevents a late admission from reporting usage or returning a connection', async () => {
  sessionStorage.setItem(storageKey, 'saved-session');
  const controller = new AbortController();
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json(config))
      .mockImplementationOnce(async () => {
        controller.abort();
        return Response.json(session());
      })
  );
  const { connection, onAllowance } = admit(controller.signal);
  await expect(connection).rejects.toMatchObject({ name: 'AbortError' });
  expect(onAllowance).not.toHaveBeenCalled();
});

test('network exhaustion reports known policy without revealing arbitrary upstream error text', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json(config))
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: 'ip_allowance',
              message: 'private provider text',
              resetsAt: '2026-11-21T00:00:00Z',
            },
          },
          { status: 429 }
        )
      )
  );
  await expect(admit().connection).rejects.toMatchObject({
    policy: { terminal: true, code: 'ip_allowance' },
  });
});
