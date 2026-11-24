import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createInferenceHandler } from './inferenceHandler';

// Fixture keys are joined from parts so secret scanners do not mistake them for real keys.
const openRouterKey = ['sk-or-', 'v1-', 'a'.repeat(64)].join('');
const openAiKey = ['sk-proj-', 'xxxx', 'T3Blbk', 'FJxxxxzzzz'].join('');

let directory: string;
let server: Server | undefined;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'katakit-inference-'));
});
afterEach(async () => {
  await new Promise(resolve => server?.close(resolve) ?? resolve(undefined));
  server = undefined;
  await rm(directory, { recursive: true, force: true });
});

const completion = (content: string, usage = { prompt_tokens: 10, completion_tokens: 5 }) =>
  new Response(
    JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }], usage }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
const checkPasses = () => completion('{"ok":true,"word":"ready"}');

/** Start the handler on a loopback port; `call` sends a same-origin browser request by default. */
const start = async ({
  environment = {},
  upstream,
}: {
  environment?: Record<string, string>;
  upstream: (url: string, init: RequestInit) => Promise<Response>;
}) => {
  const request = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    if (target.startsWith('http://127.0.0.1:11434')) throw new Error('no ollama');
    return upstream(target, init ?? {});
  });
  const file = join(directory, 'katakit', 'inference.json');
  const handler = createInferenceHandler({ environment, file, request: request as typeof fetch });
  server = createServer((incoming, response) => {
    void handler.handle(incoming, response, () => {
      response.statusCode = 404;
      response.end();
    });
  });
  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  const origin = `http://127.0.0.1:${port}`;
  const call = (path: string, init: RequestInit & { origin?: string | null; site?: string } = {}) =>
    fetch(`${origin}/__katakit/inference${path}`, {
      ...init,
      redirect: 'manual',
      headers: {
        'content-type': 'application/json',
        ...(init.origin === null ? {} : { origin: init.origin ?? origin }),
        'sec-fetch-site': init.site ?? 'same-origin',
      },
    });
  const upstreamBodies = () =>
    request.mock.calls
      .filter(([url]) => !String(url).includes('11434'))
      .map(([url, init]) => ({
        url: String(url),
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      }));
  return { call, file, upstreamBodies };
};

test('a provider variable connects without setup and the browser never sees the key', async () => {
  const { call } = await start({
    environment: { OPENROUTER_API_KEY: openRouterKey },
    upstream: async () => checkPasses(),
  });
  const status = await (await call('/status')).json();
  expect(status.connection).toMatchObject({
    provider: 'openrouter',
    source: 'environment',
    variable: 'OPENROUTER_API_KEY',
    model: 'z-ai/glm-5.3',
    keyHint: 'aaaa',
  });
  expect(JSON.stringify(status)).not.toContain(openRouterKey);
});

test('another page, another machine name, or a non-browser write is refused', async () => {
  const { call } = await start({
    environment: { OPENROUTER_API_KEY: openRouterKey },
    upstream: async () => checkPasses(),
  });
  const body = JSON.stringify({ model: 'x', messages: [] });
  expect(
    (
      await call('/chat/completions', {
        method: 'POST',
        body,
        origin: 'https://evil.test',
        site: 'cross-site',
      })
    ).status
  ).toBe(403);
  expect(
    (await call('/chat/completions', { method: 'POST', body, origin: null, site: 'cross-site' }))
      .status
  ).toBe(403);
  expect((await call('/key', { method: 'DELETE', origin: null, site: 'none' })).status).toBe(403);
});

test('a pasted key is detected, checked with a strict schema, and saved outside the demo', async () => {
  const { call, file, upstreamBodies } = await start({ upstream: async () => checkPasses() });
  const response = await call('/key', { method: 'POST', body: JSON.stringify({ key: openAiKey }) });
  expect(response.status).toBe(200);
  const { status } = await response.json();
  expect(status.connection).toMatchObject({
    provider: 'openai',
    source: 'saved',
    model: 'gpt-6.2-sol',
  });
  const [check] = upstreamBodies();
  expect(check?.url).toBe('https://api.openai.com/v1/chat/completions');
  expect(check?.headers.authorization).toBe(`Bearer ${openAiKey}`);
  expect(check?.body).toMatchObject({ model: 'gpt-6.2-sol', reasoning_effort: 'low' });
  expect(check?.body).not.toHaveProperty('reasoning');
  expect(check?.body.response_format.json_schema.strict).toBe(true);
  expect(JSON.parse(await readFile(file, 'utf8')).credential).toEqual({
    provider: 'openai',
    key: openAiKey,
  });
  // Windows has no POSIX file modes; elsewhere the saved key is readable by its owner only.
  const mode = (await stat(file)).mode & 0o777;
  expect(process.platform === 'win32' ? 0o600 : mode).toBe(0o600);
});

test('a rejected key saves nothing and its message hides the provider response', async () => {
  const { call, file } = await start({
    upstream: async () => new Response(`{"error":"invalid key ${openAiKey}"}`, { status: 401 }),
  });
  const response = await call('/key', { method: 'POST', body: JSON.stringify({ key: openAiKey }) });
  expect(response.status).toBe(422);
  const text = await response.text();
  expect(JSON.parse(text).error.code).toBe('key_rejected');
  expect(text).not.toContain(openAiKey);
  await expect(stat(file)).rejects.toThrow('ENOENT');
});

test('an unrecognized key asks for its provider; an Anthropic admin key is refused', async () => {
  const { call } = await start({ upstream: async () => checkPasses() });
  const unknown = await call('/key', { method: 'POST', body: JSON.stringify({ key: 'sk-12345' }) });
  expect((await unknown.json()).error.code).toBe('provider_unknown');
  const admin = await call('/key', {
    method: 'POST',
    body: JSON.stringify({ key: ['sk-ant-', 'admin01-', 'abc'].join('') }),
  });
  expect((await admin.json()).error.code).toBe('not_inference_key');
});

test('a saved key wins over the environment, and removing it falls back', async () => {
  const { call } = await start({
    environment: { OPENROUTER_API_KEY: openRouterKey },
    upstream: async () => checkPasses(),
  });
  await call('/key', { method: 'POST', body: JSON.stringify({ key: openAiKey }) });
  expect((await (await call('/status')).json()).connection.provider).toBe('openai');
  const { status } = await (await call('/key', { method: 'DELETE' })).json();
  expect(status.connection).toMatchObject({ provider: 'openrouter', source: 'environment' });
});

test('OpenRouter requests keep reasoning effort, require parameters, and fall back to Sonnet', async () => {
  const { call, upstreamBodies } = await start({
    environment: { OPENROUTER_API_KEY: openRouterKey },
    upstream: async () =>
      completion('{"additions":[],"rewords":[]}', {
        prompt_tokens: 100,
        completion_tokens: 20,
        cost: 0.002,
      } as never),
  });
  const response = await call('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model: 'anything', reasoning: { effort: 'low' }, messages: [] }),
  });
  expect(response.status).toBe(200);
  expect(JSON.parse(response.headers.get('x-katakit-usage')!)).toEqual({
    requests: 1,
    inputTokens: 100,
    outputTokens: 20,
    cost: 0.002,
  });
  expect(upstreamBodies()[0]?.body).toMatchObject({
    model: 'z-ai/glm-5.3',
    models: ['z-ai/glm-5.3', 'anthropic/claude-sonnet-5.5'],
    reasoning: { effort: 'low' },
    provider: { require_parameters: true },
  });
});

test('a model that fails its check is not saved and the previous model stays in use', async () => {
  const { call } = await start({
    environment: { OPENROUTER_API_KEY: openRouterKey },
    upstream: async (_url, init) =>
      JSON.parse(String(init.body)).model === 'nobody/missing-model'
        ? new Response('{"error":{"message":"model not found"}}', { status: 404 })
        : checkPasses(),
  });
  const response = await call('/model', {
    method: 'PUT',
    body: JSON.stringify({ model: 'nobody/missing-model' }),
  });
  expect((await response.json()).error).toMatchObject({
    code: 'model_unavailable',
    message: 'nobody/missing-model is not available for this key. Try the default, z-ai/glm-5.3.',
  });
  expect((await (await call('/status')).json()).connection.model).toBe('z-ai/glm-5.3');
});

test('a key on an account without credits is saved with a notice', async () => {
  const { call } = await start({
    upstream: async () => new Response('{"error":"insufficient credits"}', { status: 402 }),
  });
  const response = await call('/key', {
    method: 'POST',
    body: JSON.stringify({ key: openRouterKey }),
  });
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.status.connection.provider).toBe('openrouter');
  expect(result.notice).toContain('openrouter.ai/settings/credits');
});

test('OpenRouter sign-in uses PKCE, saves the new key, and returns to the demo', async () => {
  const { call, file, upstreamBodies } = await start({
    upstream: async url =>
      url.endsWith('/auth/keys')
        ? new Response(JSON.stringify({ key: openRouterKey }), { status: 200 })
        : checkPasses(),
  });
  const started = await call('/openrouter/start?return=/demos/notes', { site: 'same-origin' });
  expect(started.status).toBe(302);
  const authorization = new URL(started.headers.get('location')!);
  expect(authorization.origin).toBe('https://openrouter.ai');
  expect(Object.fromEntries(authorization.searchParams)).toMatchObject({
    code_challenge_method: 'S256',
    limit: '5',
    expiration: '30-days',
  });
  const state = authorization.searchParams.get('state')!;
  const finished = await call(`/openrouter/callback?code=granted&state=${state}`, {
    origin: null,
    site: 'cross-site',
  });
  expect(finished.headers.get('location')).toBe('/demos/notes?katakit-inference=connected');
  const exchange = upstreamBodies().find(({ url }) => url.endsWith('/auth/keys'))!;
  expect(exchange.body.code).toBe('granted');
  expect(exchange.body.code_verifier).toMatch(/^[\w-]{43}$/);
  expect(JSON.parse(await readFile(file, 'utf8')).credential.provider).toBe('openrouter');
  // A reused state cannot exchange a second code.
  const replay = await call(`/openrouter/callback?code=again&state=${state}`, {
    origin: null,
    site: 'cross-site',
  });
  expect(replay.headers.get('location')).toBe('/?katakit-inference=failed');
});

test('an OpenRouter key also judges with the decision model; other providers have none', async () => {
  const { call, upstreamBodies } = await start({
    environment: { OPENROUTER_API_KEY: openRouterKey },
    upstream: async () =>
      new Response(JSON.stringify({ answers: {}, usage: { input_tokens: 30, output_tokens: 4 } }), {
        status: 200,
      }),
  });
  const status = await (await call('/status')).json();
  expect(status.connection.decisions).toEqual({ model: 'typesafe/jev-1.13', maxQuestions: 16 });
  const response = await call('/decisions', {
    method: 'POST',
    body: JSON.stringify({ model: 'anything', state: '{}', questions: {} }),
  });
  expect(response.status).toBe(200);
  const [decision] = upstreamBodies();
  expect(decision?.url).toBe('https://openrouter.ai/api/alpha/decisions');
  expect(decision?.headers.authorization).toBe(`Bearer ${openRouterKey}`);
  expect(decision?.body).toEqual({ model: 'typesafe/jev-1.13', state: '{}', questions: {} });
  expect(JSON.parse(response.headers.get('x-katakit-usage')!)).toMatchObject({
    inputTokens: 30,
    outputTokens: 4,
  });
});

test('a provider without a decision model refuses decision requests', async () => {
  const { call } = await start({
    environment: { OPENAI_API_KEY: openAiKey },
    upstream: async () => checkPasses(),
  });
  expect((await (await call('/status')).json()).connection.decisions).toBeUndefined();
  const response = await call('/decisions', { method: 'POST', body: '{}' });
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('decisions_unavailable');
});
