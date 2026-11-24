import { createServer, request as httpRequest, type Server } from 'node:http';
import { afterEach, expect, test, vi } from 'vitest';
import { createLocalInferenceHandler } from '../localInferenceProxy';

const servers: Server[] = [];
const start = async (
  env: Parameters<typeof createLocalInferenceHandler>[0] = () => ({}),
  request: typeof fetch = vi.fn()
) => {
  const handler = createLocalInferenceHandler(env, request);
  const server = createServer((req, res) => {
    void handler(req, res, () => {
      res.writeHead(404).end();
    });
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test address');
  const origin = `http://127.0.0.1:${address.port}`;
  const post = (body: unknown = payload, headers: Record<string, string> = {}) =>
    fetch(`${origin}/__gallery_inference/completion`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  return { origin, post };
};
const payload = {
  model: 'browser-model',
  stream: true,
  max_completion_tokens: 100000,
  messages: [{ role: 'user', content: 'Extract this transcript.' }],
  response_format: {
    type: 'json_schema',
    json_schema: { name: 'test', schema: { type: 'object' } },
  },
};
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      server =>
        new Promise<void>(resolve => {
          server.closeAllConnections();
          server.close(() => resolve());
        })
    )
  );
});

test('status exposes only nonsecret capability metadata and never calls a provider', async () => {
  const request = vi.fn<typeof fetch>();
  const { origin } = await start(
    () => ({
      OPENROUTER_API_KEY: 'test-secret',
      OPENROUTER_MODEL: 'test/model',
      OPENROUTER_ENDPOINT: 'https://example.invalid/completions',
    }),
    request
  );
  const response = await fetch(`${origin}/__gallery_inference/status`);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const body = await response.text();
  expect(JSON.parse(body)).toEqual({
    enabled: true,
    model: 'test/model',
    maxBodyBytes: 65536,
    maxOutputTokens: 2048,
  });
  expect(body).not.toContain('test-secret');
  expect(body).not.toContain('example.invalid');
  expect(request).not.toHaveBeenCalled();
  const missing = await start();
  expect(await (await fetch(`${missing.origin}/__gallery_inference/status`)).json()).toEqual({
    enabled: false,
  });
  expect((await missing.post()).status).toBe(503);
});

test('explicit same-origin completion adds credentials only upstream, forces server model and bounds generation', async () => {
  const request = vi.fn<typeof fetch>(async () =>
    Response.json({
      choices: [{ finish_reason: 'stop', message: { content: '{"items":[]}' } }],
      private_field: 'not-for-browser',
    })
  );
  const { post } = await start(
    () => ({ OPENROUTER_API_KEY: 'test-secret', OPENROUTER_MODEL: 'server/model' }),
    request
  );
  const response = await post();
  expect(response.status).toBe(200);
  const [url, init] = request.mock.calls[0]!;
  expect(String(url)).toBe('https://openrouter.ai/api/v1/chat/completions');
  expect(init!.headers).toMatchObject({ Authorization: 'Bearer test-secret' });
  expect(init!.redirect).toBe('error');
  expect(JSON.parse(String(init!.body))).toMatchObject({
    model: 'server/model',
    stream: false,
    max_completion_tokens: 2048,
    messages: payload.messages,
  });
  const output = await response.text();
  expect(output).not.toContain('test-secret');
  expect(output).not.toContain('private_field');
});

test('rejects foreign origins, rebinding hosts, methods, malformed requests and oversized bodies before spending credits', async () => {
  const request = vi.fn<typeof fetch>();
  const { origin, post } = await start(() => ({ OPENROUTER_API_KEY: 'test-secret' }), request);
  expect((await post(payload, { Origin: 'https://unrelated.invalid' })).status).toBe(403);
  const rebound = await new Promise<number | undefined>((resolve, reject) => {
    const request = httpRequest(
      `${origin}/__gallery_inference/completion`,
      {
        method: 'POST',
        headers: { Host: 'unrelated.invalid', Origin: origin, 'Content-Type': 'application/json' },
      },
      response => {
        response.resume();
        response.once('end', () => resolve(response.statusCode));
      }
    );
    request.on('error', reject);
    request.end(JSON.stringify(payload));
  });
  expect(rebound).toBe(403);
  expect(
    (await fetch(`${origin}/__gallery_inference/completion`, { method: 'POST', body: '{}' })).status
  ).toBe(403);
  expect((await fetch(`${origin}/__gallery_inference/completion`, { method: 'GET' })).status).toBe(
    405
  );
  expect((await post('invalid JSON')).status).toBe(400);
  expect((await post({ messages: [] })).status).toBe(400);
  expect((await post(payload, { 'Content-Type': 'text/plain' })).status).toBe(415);
  expect(
    (await post({ ...payload, messages: [{ role: 'user', content: 'x'.repeat(66000) }] })).status
  ).toBe(413);
  expect(request).not.toHaveBeenCalled();
});

test('provider failures and invalid server configuration never echo keys, raw bodies or endpoint URLs', async () => {
  const request = vi.fn<typeof fetch>(
    async () => new Response('test-secret private provider details', { status: 401 })
  );
  const { post } = await start(() => ({ OPENROUTER_API_KEY: 'test-secret' }), request);
  const response = await post();
  expect(response.status).toBe(401);
  expect(await response.text()).not.toMatch(/test-secret|private provider details/);
  const invalid = await start(
    () => ({
      OPENROUTER_API_KEY: 'test-secret',
      OPENROUTER_ENDPOINT: 'http://remote.invalid/completion?key=test-secret',
    }),
    request
  );
  expect((await invalid.post()).status).toBe(503);
  expect(request).toHaveBeenCalledOnce();
});

test('client cancellation aborts the actual upstream fetch signal', async () => {
  let upstream!: AbortSignal;
  const request = vi.fn<typeof fetch>(async (_url, init) => {
    upstream = init!.signal!;
    await new Promise<void>((_resolve, reject) =>
      upstream.addEventListener('abort', () => reject(upstream.reason), { once: true })
    );
    return Response.json({});
  });
  const { origin } = await start(() => ({ OPENROUTER_API_KEY: 'test-secret' }), request);
  const controller = new AbortController();
  const job = fetch(`${origin}/__gallery_inference/completion`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });
  await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
  controller.abort();
  await expect(job).rejects.toThrow(/aborted/i);
  await vi.waitFor(() => expect(upstream.aborted).toBe(true));
});
