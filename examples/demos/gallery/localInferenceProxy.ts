import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

type Settings = {
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_ENDPOINT?: string;
};
const basePath = '/__gallery_inference';
const maxBodyBytes = 65_536;
const loopback = (hostname: string) =>
  ['localhost', '127.0.0.1', '[::1]', '::1', '::ffff:127.0.0.1'].includes(hostname);

const json = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(body));
};

/** Local Vite middleware, never a deployed Worker route or a browser import. */
export const createLocalInferenceHandler =
  (settings: () => Settings, request: typeof fetch = fetch) =>
  async (incoming: IncomingMessage, response: ServerResponse, next: () => void) => {
    const path = incoming.url?.split('?')[0];
    if (path !== `${basePath}/status` && path !== `${basePath}/completion`) {
      next();
      return;
    }
    let origin: URL;
    try {
      origin = new URL(`http://${incoming.headers.host}`);
    } catch {
      json(response, 403, { error: 'Local access only.' });
      return;
    }
    if (
      !loopback(origin.hostname) ||
      !loopback(incoming.socket.remoteAddress ?? '') ||
      (incoming.headers.origin && incoming.headers.origin !== origin.origin)
    ) {
      json(response, 403, { error: 'Local same-origin access only.' });
      return;
    }
    let env: Settings;
    try {
      env = settings();
    } catch {
      json(response, 503, { error: 'Could not read the local server environment.' });
      return;
    }
    const key = env.OPENROUTER_API_KEY?.trim();
    const model = env.OPENROUTER_MODEL?.trim() || 'z-ai/glm-5.3';
    if (path === `${basePath}/status` && incoming.method === 'GET') {
      json(
        response,
        200,
        key ? { enabled: true, model, maxBodyBytes, maxOutputTokens: 2048 } : { enabled: false }
      );
      return;
    }
    if (path !== `${basePath}/completion` || incoming.method !== 'POST') {
      json(response, 405, { error: 'Method not allowed.' });
      return;
    }
    if (incoming.headers.origin !== origin.origin) {
      json(response, 403, { error: 'A same-origin request is required.' });
      return;
    }
    if (!key) {
      json(response, 503, {
        error: 'Set OPENROUTER_API_KEY on the local gallery server, then restart it.',
      });
      return;
    }
    if (!incoming.headers['content-type']?.startsWith('application/json')) {
      json(response, 415, { error: 'Send a JSON completion request.' });
      return;
    }
    if (Number(incoming.headers['content-length']) > maxBodyBytes) {
      json(response, 413, { error: 'The completion request exceeds the local input limit.' });
      return;
    }
    const controller = new AbortController();
    const disconnected = () => {
      if (!response.writableEnded) controller.abort();
    };
    incoming.once('aborted', disconnected);
    response.once('close', disconnected);
    const timeout = setTimeout(() => {
      controller.abort();
      if (!incoming.complete) incoming.destroy();
    }, 120_000);
    timeout.unref();
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of incoming) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.byteLength;
        if (size > maxBodyBytes) {
          json(response, 413, { error: 'The completion request exceeds the local input limit.' });
          return;
        }
        chunks.push(buffer);
      }
      let input: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
          throw new Error('Invalid request');
        input = parsed as Record<string, unknown>;
        if (
          !Array.isArray(input.messages) ||
          !input.messages.length ||
          input.messages.some(
            message =>
              !message ||
              typeof message !== 'object' ||
              !['system', 'user', 'assistant'].includes(message.role) ||
              typeof message.content !== 'string'
          ) ||
          !input.response_format ||
          typeof input.response_format !== 'object'
        )
          throw new Error('Invalid request');
      } catch {
        json(response, 400, { error: 'Invalid chat-completions request.' });
        return;
      }
      let endpoint: URL;
      try {
        endpoint = new URL(
          env.OPENROUTER_ENDPOINT?.trim() || 'https://openrouter.ai/api/v1/chat/completions'
        );
        if (
          (endpoint.protocol !== 'https:' &&
            !(endpoint.protocol === 'http:' && loopback(endpoint.hostname))) ||
          endpoint.username ||
          endpoint.password ||
          endpoint.search ||
          endpoint.hash
        )
          throw new Error('Invalid endpoint');
      } catch {
        json(response, 503, { error: 'Check OPENROUTER_ENDPOINT on the local gallery server.' });
        return;
      }
      const upstream = await request(endpoint, {
        method: 'POST',
        signal: controller.signal,
        redirect: 'error',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          stream: false,
          messages: input.messages,
          response_format: input.response_format,
          max_completion_tokens: Math.min(
            2048,
            Math.max(
              1,
              typeof input.max_completion_tokens === 'number' &&
                Number.isFinite(input.max_completion_tokens)
                ? Math.floor(input.max_completion_tokens)
                : 2048
            )
          ),
          reasoning: { effort: 'low' },
        }),
      });
      if (controller.signal.aborted || response.destroyed) return;
      if (!upstream.ok) {
        await upstream.body?.cancel();
        json(
          response,
          upstream.status === 401 || upstream.status === 403
            ? 401
            : upstream.status === 402
              ? 402
              : upstream.status === 429
                ? 429
                : 502,
          {
            error:
              upstream.status === 401 || upstream.status === 403
                ? 'The provider rejected OPENROUTER_API_KEY. Check the server environment and restart.'
                : upstream.status === 402
                  ? 'The server’s provider account needs credits.'
                  : upstream.status === 429
                    ? 'The provider is rate limiting requests. Wait, then try again.'
                    : 'The provider could not complete this request. Check the server model configuration.',
          }
        );
        return;
      }
      const completion: unknown = await upstream.json();
      if (controller.signal.aborted || response.destroyed) return;
      if (!completion || typeof completion !== 'object' || !('choices' in completion)) {
        json(response, 502, { error: 'The provider returned an unreadable completion.' });
        return;
      }
      json(response, 200, { choices: completion.choices });
    } catch {
      if (!response.destroyed)
        json(response, controller.signal.aborted ? 504 : 502, {
          error: controller.signal.aborted
            ? 'The completion request timed out or was cancelled.'
            : 'Could not reach the provider. Check the local server configuration.',
        });
    } finally {
      clearTimeout(timeout);
      incoming.off('aborted', disconnected);
      response.off('close', disconnected);
    }
  };

/** The env reader executes only in local dev/preview, not while building client assets. */
export const localInferenceProxy = (settings: () => Settings): Plugin => ({
  name: 'gallery-local-inference',
  enforce: 'pre',
  configureServer: server => {
    server.middlewares.use(createLocalInferenceHandler(settings));
  },
  configurePreviewServer: server => {
    server.middlewares.use(createLocalInferenceHandler(settings));
  },
});
