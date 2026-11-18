import { createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as v from 'valibot';
import {
  inferenceRoute,
  signInResultParameter,
  type InferenceConnectionStatus,
  type InferenceError,
  type InferenceStatus,
  type InferenceUsage,
  type SignInResult,
} from '../src/inference/inferenceStatus';
import {
  addInferenceUsage,
  describeUpstreamFailure,
  detectInferenceProvider,
  environmentProviders,
  getInferenceProvider,
  inferenceProviders,
  prepareInferenceRequest,
  readCompletionUsage,
  type InferenceProvider,
} from './providers';
import {
  readSavedInference,
  writeSavedInference,
  type SavedCredential,
  type SavedInference,
} from './savedInference';

/** A credential resolved to the URL, key, and model one request uses. */
export type InferenceConnection = {
  provider: InferenceProvider;
  url: string;
  key?: string;
  source: 'saved' | 'environment';
  variable?: string;
  model: string;
  upstream?: string;
};

type Outcome =
  | { ok: true; completion: unknown }
  | { ok: false; status: number; error: InferenceError['error'] };

const emptyUsage: InferenceUsage = { requests: 0, inputTokens: 0, outputTokens: 0 };
const loopbackHosts = ['localhost', '127.0.0.1', '[::1]'];
const loopbackAddresses = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
const maxRequestBytes = 262_144;
const signInLifetimeMs = 10 * 60_000;

const KeyRequestSchema = v.strictObject({
  key: v.optional(v.pipe(v.string(), v.trim())),
  provider: v.optional(v.picklist(inferenceProviders.map(provider => provider.id))),
  model: v.optional(v.pipe(v.string(), v.trim())),
  endpoint: v.optional(v.pipe(v.string(), v.trim())),
});
const ModelRequestSchema = v.strictObject({
  model: v.optional(v.pipe(v.string(), v.trim())),
  upstream: v.optional(v.pipe(v.string(), v.trim())),
});

/** A strict two-property schema proves the key, the model, and structured output in one call. */
const connectionCheckBody = {
  max_completion_tokens: 1024,
  reasoning: { effort: 'low' },
  messages: [{ role: 'user', content: 'Set ok to true and word to "ready".' }],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'connection_check',
      strict: true,
      schema: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, word: { type: 'string' } },
        required: ['ok', 'word'],
        additionalProperties: false,
      },
    },
  },
};

class RequestError extends Error {
  constructor(
    public status: number,
    public error: InferenceError['error']
  ) {
    super(error.message);
  }
}

const badRequest = (message: string) => new RequestError(400, { code: 'bad_request', message });

/**
 * A key-bearing local route would let any web page spend the key, so every route answers only
 * same-origin requests from this machine. The sign-in callback is the exception: OpenRouter
 * redirects to it, and its single-use `state` and PKCE verifier protect it instead.
 */
const isTrustedRequest = (request: IncomingMessage, path: string) => {
  const host = request.headers.host ?? '';
  let hostname: string;
  try {
    hostname = new URL(`http://${host}`).hostname;
  } catch {
    return false;
  }
  if (!loopbackHosts.includes(hostname)) return false;
  if (!loopbackAddresses.includes(request.socket.remoteAddress ?? '')) return false;
  if (path === '/openrouter/callback') return true;
  const site = request.headers['sec-fetch-site'];
  const origin = request.headers.origin;
  if (site && site !== 'same-origin' && !(site === 'none' && request.method === 'GET'))
    return false;
  if (origin && origin !== `http://${host}`) return false;
  // Writes must come from this page; a request without either header is not from a browser tab.
  return request.method === 'GET' || site === 'same-origin' || origin === `http://${host}`;
};

const readJson = async (request: IncomingMessage) => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).byteLength;
    if (size > maxRequestBytes) throw badRequest('The request is too large.');
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as unknown;
  } catch {
    throw badRequest('The request is not valid JSON.');
  }
};

const send = (response: ServerResponse, status: number, body: unknown, headers = {}) => {
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    ...headers,
  });
  response.end(JSON.stringify(body));
};

const redirect = (response: ServerResponse, location: string) => {
  response.writeHead(302, { location, 'cache-control': 'no-store' });
  response.end();
};

/** HTTPS anywhere, or plain HTTP to this machine; no embedded credentials, query, or fragment. */
const validateEndpoint = (endpoint: string | undefined) => {
  let url: URL;
  try {
    url = new URL(endpoint ?? '');
  } catch {
    throw badRequest('Enter a full chat-completions endpoint URL.');
  }
  const local = loopbackHosts.includes(url.hostname);
  if (
    !(url.protocol === 'https:' || (local && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw badRequest('Use HTTPS (or local HTTP), with no credentials, query, or fragment.');
  return url.toString();
};

/**
 * The dev server's model connection: credential lookup, connection checks, request forwarding,
 * usage totals, and OpenRouter sign-in. State that outlives a request (usage and pending
 * sign-ins) belongs to this handler, which lives as long as the dev server.
 */
export const createInferenceHandler = ({
  environment,
  file,
  request = fetch,
  now = Date.now,
}: {
  environment: Record<string, string | undefined>;
  file: string;
  request?: typeof fetch;
  now?: () => number;
}) => {
  let usage = emptyUsage;
  const signIns: Record<string, { verifier: string; returnPath: string; expiresAt: number }> = {};

  /** A saved credential wins because saving is explicit; then the first provider variable. */
  const resolveConnection = (saved: SavedInference): InferenceConnection | undefined => {
    const choice = (provider: InferenceProvider) => {
      const model = saved.models?.[provider.id]?.model ?? provider.defaultModel;
      const upstream =
        provider.id === 'openrouter' ? saved.models?.openrouter?.upstream : undefined;
      return model ? { model, ...(upstream ? { upstream } : {}) } : undefined;
    };
    const credential = saved.credential;
    if (credential) {
      const provider = getInferenceProvider(credential.provider);
      const chosen = choice(provider);
      if (!chosen) return undefined;
      return {
        provider,
        url:
          credential.provider === 'custom'
            ? credential.endpoint
            : `${provider.baseUrl}/chat/completions`,
        key: 'key' in credential ? credential.key : undefined,
        source: 'saved',
        ...chosen,
      };
    }
    for (const provider of environmentProviders) {
      for (const variable of provider.environment) {
        const key = environment[variable]?.trim();
        const chosen = choice(provider);
        if (key && chosen)
          return {
            provider,
            url: `${provider.baseUrl}/chat/completions`,
            key,
            source: 'environment',
            variable,
            ...chosen,
          };
      }
    }
    return undefined;
  };

  const describeConnection = (connection: InferenceConnection): InferenceConnectionStatus => {
    const { provider } = connection;
    return {
      provider: provider.id,
      providerName: provider.name,
      source: connection.source,
      ...(connection.variable ? { variable: connection.variable } : {}),
      ...(connection.key ? { keyHint: connection.key.slice(-4) } : {}),
      model: connection.model,
      ...(provider.defaultModel ? { defaultModel: provider.defaultModel } : {}),
      ...(connection.upstream ? { upstream: connection.upstream } : {}),
      ...(provider.id === 'custom' ? { endpointHost: new URL(connection.url).host } : {}),
    };
  };

  /** Ollama is offered, never chosen automatically: its models' note quality is unknown. */
  const probeOllama = async () => {
    try {
      const response = await request('http://127.0.0.1:11434/v1/models', {
        signal: AbortSignal.timeout(800),
      });
      if (!response.ok) return undefined;
      const body = (await response.json()) as { data?: { id?: unknown }[] };
      const models = (body.data ?? []).flatMap(model =>
        typeof model.id === 'string' ? [model.id] : []
      );
      return models.length ? models : undefined;
    } catch {
      return undefined;
    }
  };

  const readStatus = async (): Promise<InferenceStatus> => {
    const connection = resolveConnection(await readSavedInference(file));
    const ollamaModels = connection ? undefined : await probeOllama();
    return {
      ...(connection ? { connection: describeConnection(connection) } : {}),
      usage,
      providers: environmentProviders.map(provider => ({
        id: provider.id,
        name: provider.name,
        ...(provider.defaultModel ? { defaultModel: provider.defaultModel } : {}),
      })),
      ...(ollamaModels ? { ollamaModels } : {}),
      environmentVariables: environmentProviders.flatMap(provider => provider.environment),
    };
  };

  /** Forward one body to the connection's provider and count the tokens it reports. */
  const complete = async ({
    connection,
    body,
    allowFallback,
    signal,
  }: {
    connection: InferenceConnection;
    body: Record<string, unknown>;
    allowFallback: boolean;
    signal?: AbortSignal;
  }): Promise<Outcome> => {
    const { provider, model } = connection;
    let response: Response;
    try {
      response = await request(connection.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(connection.key ? { authorization: `Bearer ${connection.key}` } : {}),
        },
        body: JSON.stringify(
          prepareInferenceRequest({
            provider,
            model,
            upstream: connection.upstream,
            body,
            allowFallback,
          })
        ),
        redirect: 'error',
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      return {
        ok: false,
        status: 502,
        error: {
          code: 'unreachable',
          message:
            provider.id === 'ollama'
              ? 'Could not reach Ollama at 127.0.0.1:11434. Is it running?'
              : `Could not reach ${provider.name}. Check your network and try again.`,
        },
      };
    }
    const text = await response.text();
    if (!response.ok) {
      const error = describeUpstreamFailure({ provider, model, status: response.status, text });
      return { ok: false, status: error.code === 'rate_limited' ? 429 : 502, error };
    }
    let completion: unknown;
    try {
      completion = JSON.parse(text);
    } catch {
      return {
        ok: false,
        status: 502,
        error: {
          code: 'response_unreadable',
          message: `${provider.name} returned a response this demo could not read.`,
        },
      };
    }
    usage = addInferenceUsage(usage, readCompletionUsage(completion));
    return { ok: true, completion };
  };

  /** One small real request; a key or model that fails it is never saved. */
  const checkConnection = async (connection: InferenceConnection): Promise<Outcome> => {
    const outcome = await complete({ connection, body: connectionCheckBody, allowFallback: false });
    if (!outcome.ok) return outcome;
    const content = (outcome.completion as { choices?: { message?: { content?: unknown } }[] })
      .choices?.[0]?.message?.content;
    try {
      const result = JSON.parse(typeof content === 'string' ? content : '') as unknown;
      if (
        typeof result === 'object' &&
        result !== null &&
        typeof (result as { ok?: unknown }).ok === 'boolean' &&
        typeof (result as { word?: unknown }).word === 'string'
      )
        return outcome;
    } catch {}
    return {
      ok: false,
      status: 502,
      error: {
        code: 'structured_output_unsupported',
        message: `${connection.model} did not return valid structured output. Choose another model.`,
      },
    };
  };

  /**
   * Save a candidate configuration only after its connection check passes. A key whose account
   * has no credits is still a working key, so it is saved with a notice instead of discarded.
   */
  const saveChecked = async (next: SavedInference) => {
    const connection = resolveConnection(next);
    if (!connection) throw badRequest('Choose a model.');
    const outcome = await checkConnection(connection);
    if (!outcome.ok && outcome.error.code !== 'no_credits')
      throw new RequestError(422, outcome.error);
    await writeSavedInference(file, next);
    return {
      status: await readStatus(),
      ...(outcome.ok ? {} : { notice: outcome.error.message }),
    };
  };

  const withModel = (
    saved: SavedInference,
    provider: InferenceProvider['id'],
    choice: { model: string; upstream?: string } | undefined
  ): SavedInference => {
    const { [provider]: _, ...models } = saved.models ?? {};
    return { ...saved, models: choice ? { ...models, [provider]: choice } : models };
  };

  const saveKey = async (body: unknown) => {
    const input = v.parse(KeyRequestSchema, body);
    const saved = await readSavedInference(file);
    const detected = input.provider ?? (input.key ? detectInferenceProvider(input.key) : undefined);
    if (detected === 'notInference')
      throw new RequestError(400, {
        code: 'not_inference_key',
        message:
          'This is an Anthropic admin key or sign-in token, not an API key. Create an API key in the Anthropic Console.',
      });
    if (!detected)
      throw new RequestError(400, {
        code: 'provider_unknown',
        message: 'This key doesn’t match a known provider. Choose the provider it belongs to.',
      });
    let credential: SavedCredential;
    let next = saved;
    if (detected === 'ollama' || detected === 'custom') {
      if (!input.model) throw badRequest('Choose a model.');
      next = withModel(saved, detected, { model: input.model });
      credential =
        detected === 'ollama'
          ? { provider: 'ollama' }
          : {
              provider: 'custom',
              endpoint: validateEndpoint(input.endpoint),
              ...(input.key ? { key: input.key } : {}),
            };
    } else {
      if (!input.key) throw badRequest('Paste an API key.');
      if (/\s/.test(input.key)) throw badRequest('An API key cannot contain spaces.');
      credential = { provider: detected, key: input.key };
    }
    return saveChecked({ ...next, credential });
  };

  const saveModel = async (body: unknown) => {
    const input = v.parse(ModelRequestSchema, body);
    const saved = await readSavedInference(file);
    const connection = resolveConnection(saved);
    if (!connection)
      throw new RequestError(409, {
        code: 'no_connection',
        message: 'Connect a key before choosing a model.',
      });
    const { provider } = connection;
    if (!input.model) {
      if (!provider.defaultModel) throw badRequest('Choose a model.');
      const next = withModel(saved, provider.id, undefined);
      await writeSavedInference(file, next);
      return { status: await readStatus() };
    }
    return saveChecked(
      withModel(saved, provider.id, {
        model: input.model,
        ...(provider.id === 'openrouter' && input.upstream ? { upstream: input.upstream } : {}),
      })
    );
  };

  const removeKey = async () => {
    const { credential: _, ...rest } = await readSavedInference(file);
    await writeSavedInference(file, rest);
    return { status: await readStatus() };
  };

  const forward = async (requestBody: unknown, response: ServerResponse) => {
    const connection = resolveConnection(await readSavedInference(file));
    if (!connection)
      throw new RequestError(409, {
        code: 'no_connection',
        message: 'No model is set up. Set one up in the demo.',
      });
    if (typeof requestBody !== 'object' || requestBody === null || Array.isArray(requestBody))
      throw badRequest('Send a chat-completions request body.');
    const lifetime = new AbortController();
    response.on('close', () => {
      if (!response.writableEnded) lifetime.abort();
    });
    const outcome = await complete({
      connection,
      body: requestBody as Record<string, unknown>,
      allowFallback: true,
      signal: lifetime.signal,
    });
    const headers = { 'x-katakit-usage': JSON.stringify(usage) };
    if (outcome.ok) send(response, 200, outcome.completion, headers);
    else send(response, outcome.status, { error: outcome.error }, headers);
  };

  const startSignIn = (url: URL, request_: IncomingMessage, response: ServerResponse) => {
    const returnPath = url.searchParams.get('return') ?? '/';
    if (!returnPath.startsWith('/') || returnPath.startsWith('//'))
      throw badRequest('Invalid return path.');
    for (const [state, pending] of Object.entries(signIns))
      if (pending.expiresAt < now()) delete signIns[state];
    const verifier = randomBytes(32).toString('base64url');
    const state = randomBytes(16).toString('base64url');
    signIns[state] = { verifier, returnPath, expiresAt: now() + signInLifetimeMs };
    const authorization = new URL('https://openrouter.ai/auth');
    authorization.search = new URLSearchParams({
      callback_url: `http://${request_.headers.host}${inferenceRoute}/openrouter/callback`,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      key_label: 'Katakit local demo',
      limit: '5',
      expiration: '30-days',
      state,
    }).toString();
    redirect(response, authorization.toString());
  };

  /** Exchange the code, check the key, save it, and return to the demo with the result. */
  const finishSignIn = async (url: URL, response: ServerResponse) => {
    const state = url.searchParams.get('state') ?? '';
    const code = url.searchParams.get('code');
    const matched = signIns[state];
    if (matched) delete signIns[state];
    // A denied authorization returns without state; go back to the most recent sign-in's page.
    const returnPath =
      matched?.returnPath ??
      Object.values(signIns).toSorted((first, second) => second.expiresAt - first.expiresAt)[0]
        ?.returnPath ??
      '/';
    const back = (result: SignInResult) => {
      const target = new URL(returnPath, 'http://local');
      target.searchParams.set(signInResultParameter, result);
      redirect(response, `${target.pathname}${target.search}`);
    };
    if (!code) return back('cancelled');
    if (!matched || matched.expiresAt < now()) return back('failed');
    const exchange = await request('https://openrouter.ai/api/v1/auth/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code,
        code_verifier: matched.verifier,
        code_challenge_method: 'S256',
      }),
    }).catch(() => undefined);
    const key = exchange?.ok ? ((await exchange.json()) as { key?: unknown }).key : undefined;
    if (typeof key !== 'string' || !key) return back('failed');
    try {
      const saved = await readSavedInference(file);
      const result = await saveChecked({ ...saved, credential: { provider: 'openrouter', key } });
      return back(result.notice ? 'no_credits' : 'connected');
    } catch {
      return back('failed');
    }
  };

  const route = async (
    path: string,
    url: URL,
    request_: IncomingMessage,
    response: ServerResponse
  ) => {
    switch (`${request_.method} ${path}`) {
      case 'GET /status':
        return send(response, 200, await readStatus());
      case 'POST /key':
        return send(response, 200, await saveKey(await readJson(request_)));
      case 'DELETE /key':
        return send(response, 200, await removeKey());
      case 'PUT /model':
        return send(response, 200, await saveModel(await readJson(request_)));
      case 'DELETE /usage':
        usage = emptyUsage;
        return send(response, 200, { status: await readStatus() });
      case 'POST /chat/completions':
        return forward(await readJson(request_), response);
      case 'GET /openrouter/start':
        return startSignIn(url, request_, response);
      case 'GET /openrouter/callback':
        return finishSignIn(url, response);
      default:
        throw new RequestError(404, { code: 'bad_request', message: 'Unknown inference route.' });
    }
  };

  const handle = async (
    request_: IncomingMessage,
    response: ServerResponse,
    next: (error?: unknown) => void
  ) => {
    const url = new URL(request_.url ?? '/', 'http://local');
    if (url.pathname !== inferenceRoute && !url.pathname.startsWith(`${inferenceRoute}/`))
      return next();
    const path = url.pathname.slice(inferenceRoute.length);
    if (!isTrustedRequest(request_, path))
      return send(response, 403, {
        error: {
          code: 'forbidden',
          message: 'Only this dev server’s own pages can use this route.',
        },
      });
    try {
      await route(path, url, request_, response);
    } catch (error) {
      if (response.headersSent) return response.end();
      if (error instanceof RequestError)
        return send(response, error.status, { error: error.error });
      if (v.isValiError(error))
        return send(response, 400, { error: badRequest('Invalid request.').error });
      // Unknown failures can carry file paths or provider details; report a fixed message.
      send(response, 500, {
        error: {
          code: 'upstream_failed',
          message: 'The model connection failed. Check the dev server output.',
        },
      });
      console.error('[katakit inference]', error instanceof Error ? error.message : error);
    }
  };

  /** One line for the dev server's startup output. */
  const describeStartup = async () => {
    try {
      const connection = resolveConnection(await readSavedInference(file));
      if (!connection) return 'no key found, set one up in the demo';
      const source =
        connection.source === 'environment'
          ? `${connection.variable} found in environment`
          : `saved ${connection.provider.name} ${connection.provider.id === 'ollama' ? 'connection' : 'key'}`;
      return `${source}, using ${connection.model}`;
    } catch (error) {
      return error instanceof Error ? error.message : 'could not read saved settings';
    }
  };

  return { handle, describeStartup, resolveConnection, complete, checkConnection };
};
