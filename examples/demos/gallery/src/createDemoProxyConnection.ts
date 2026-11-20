import {
  GalleryModelError,
  type GalleryModelConnect,
  type GalleryModelConnection,
} from '../shared/galleryModel';
import * as v from 'valibot';
import { requestTurnstileToken } from './requestTurnstileToken';

const configSchema = v.object({
  sitekey: v.pipe(v.string(), v.minLength(1)),
  action: v.literal('demo_session'),
  enabled: v.boolean(),
  defaultModel: v.literal('z-ai/glm-5.3'),
  limits: v.object({
    MAX_BODY_BYTES: v.pipe(v.number(), v.integer(), v.minValue(1)),
    MAX_OUTPUT_TOKENS: v.pipe(v.number(), v.integer(), v.minValue(1)),
    DEADLINE_MS: v.pipe(v.number(), v.integer(), v.minValue(1)),
  }),
});
const sessionSchema = v.object({ credential: v.pipe(v.string(), v.minLength(1)) });
const sessionStateSchema = v.object({
  expiresAt: v.pipe(v.string(), v.isoTimestamp()),
  callsRemaining: v.pipe(v.number(), v.integer(), v.minValue(0)),
  total: v.pipe(v.number(), v.integer(), v.minValue(1)),
});
/**
 * Only our known codes become UI copy; provider text and transport exceptions stay private.
 */
const demoProxyError = async (response: Response) => {
  const parsed = v.safeParse(
    v.object({
      error: v.object({
        code: v.string(),
        resetsAt: v.optional(v.string()),
      }),
    }),
    await response.json().catch(() => undefined)
  );
  const code = parsed.success ? parsed.output.error.code : 'request_failed';
  const resetsAt = parsed.success ? parsed.output.error.resetsAt : undefined;
  const reset =
    resetsAt && Number.isFinite(Date.parse(resetsAt))
      ? ` It resets at ${new Date(resetsAt).toLocaleString()}.`
      : '';
  const terminalMessages: Record<string, string> = {
    session_allowance: "You've used this session's demo allowance.",
    global_allowance: `The demo has reached today's limit.${reset}`,
    ip_allowance: `This network has reached today's demo limit.${reset}`,
    provider_allowance: "The demo's model allowance is used up. Please try again later.",
    demo_disabled: 'This demo is paused right now.',
  };
  if (terminalMessages[code])
    return new GalleryModelError(terminalMessages[code], { terminal: true, code, resetsAt });
  if (['session_expired', 'session_required'].includes(code))
    return new GalleryModelError('Your demo session has expired.', {
      restart: true,
      code,
    });
  if (['session_rate', 'session_busy', 'global_busy'].includes(code)) {
    const seconds = Number(response.headers.get('Retry-After'));
    return new GalleryModelError(
      code === 'global_busy' ? 'The demo is busy. It will catch up.' : '',
      {
        code,
        retryAfterMs: Math.max(1, Number.isFinite(seconds) ? seconds : 2) * 1000,
        retryLimit: 2,
      }
    );
  }
  if (['verification_failed', 'session_creation_rate'].includes(code))
    return new GalleryModelError("We couldn't verify this browser. Try again.", { code });
  if (code === 'provider_failed' || code === 'proxy_unavailable') {
    const seconds = Number(response.headers.get('Retry-After'));
    return new GalleryModelError('The model is delayed. Try again.', {
      code,
      retryAfterMs: Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1500,
      retryLimit: 1,
    });
  }
  return new GalleryModelError('The demo could not connect. Try again later.', { code });
};

/**
 * The preview host's model connection for every gallery demo that needs a remote model.
 * Reconnecting reuses the tab's credential. Only the server owns the remaining allowance.
 */
export const createDemoProxyConnection =
  (proxyUrl: string): GalleryModelConnect =>
  async ({ signal, verification: container, onAllowance }) => {
    const endpoint = (path: string) => new URL(path, proxyUrl).href;
    const configResponse = await fetch(endpoint('/config'), {
      signal,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
    });
    if (!configResponse.ok) throw await demoProxyError(configResponse);
    const config = v.parse(configSchema, await configResponse.json());
    if (!config.enabled)
      throw new GalleryModelError('This demo is paused right now.', { terminal: true });
    const storageKey = `katakit-demo-session:${new URL(proxyUrl).origin}`;
    let credential = sessionStorage.getItem(storageKey) ?? undefined;
    const readSession = (credential: string) =>
      fetch(endpoint('/session'), {
        signal,
        credentials: 'omit',
        redirect: 'error',
        headers: { Authorization: `Bearer ${credential}` },
      });
    let sessionResponse = credential ? await readSession(credential) : undefined;
    if (sessionResponse?.status === 401) {
      sessionStorage.removeItem(storageKey);
      credential = undefined;
    }
    if (!credential) {
      const token = await requestTurnstileToken({
        container,
        sitekey: config.sitekey,
        action: config.action,
        signal,
      });
      const created = await fetch(endpoint('/session'), {
        method: 'POST',
        signal,
        credentials: 'omit',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!created.ok) throw await demoProxyError(created);
      credential = v.parse(sessionSchema, await created.json()).credential;
      // Save before inference so even an interrupted request keeps its charged session after refresh.
      sessionStorage.setItem(storageKey, credential);
      sessionResponse = await readSession(credential);
    }
    if (!sessionResponse) throw new Error('Missing session response');
    if (!sessionResponse.ok) throw await demoProxyError(sessionResponse);
    const session = v.parse(sessionStateSchema, await sessionResponse.json());
    signal.throwIfAborted();
    if (session.callsRemaining > session.total)
      throw new GalleryModelError('The service returned invalid allowance data.');
    const total = session.total;
    onAllowance({ remaining: session.callsRemaining, total });
    if (session.callsRemaining === 0) {
      throw new GalleryModelError("You've used this session's demo allowance.", {
        terminal: true,
        code: 'session_allowance',
      });
    }
    let requestId: string | undefined;
    return {
      model: config.defaultModel,
      maxBodyBytes: config.limits.MAX_BODY_BYTES,
      maxOutputTokens: config.limits.MAX_OUTPUT_TOKENS,
      reportFailure: failure => {
        // Correlate validation failures with proxy metadata without recording transcript or model text.
        console.warn(
          JSON.stringify({
            type: 'demo_request_failed',
            code: failure.policy.code ?? 'request_failed',
            requestId,
          })
        );
      },
      requestCompletion: async ({ body, signal: requestSignal }) => {
        requestId = undefined;
        if (Date.now() >= Date.parse(session.expiresAt)) {
          sessionStorage.removeItem(storageKey);
          throw new GalleryModelError('Your demo session has expired.', {
            restart: true,
          });
        }
        let response: Response;
        let completion: unknown;
        try {
          response = await fetch(endpoint('/v1/chat/completions'), {
            method: 'POST',
            credentials: 'omit',
            redirect: 'error',
            body,
            signal: AbortSignal.any([
              signal,
              requestSignal,
              AbortSignal.timeout(config.limits.DEADLINE_MS + 5000),
            ]),
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${credential}`,
            },
          });
          requestId = response.headers.get('X-Request-Id') ?? undefined;
          const remaining = response.headers.get('X-Demo-Session-Calls-Remaining');
          const count = remaining === null ? NaN : Number(remaining);
          if (
            remaining !== null &&
            /^\d+$/.test(remaining) &&
            Number.isSafeInteger(count) &&
            count <= total
          ) {
            if (!signal.aborted && !requestSignal.aborted) onAllowance({ remaining: count, total });
          }
          // Headers report the charge even if reading the completion body is interrupted.
          if (response.ok) completion = await response.json();
        } catch (error) {
          if (signal.aborted || requestSignal.aborted) throw error;
          if (error instanceof SyntaxError)
            throw new GalleryModelError('The model returned an unreadable response. Try again.', {
              code: 'response_format',
            });
          throw new GalleryModelError('The model is delayed. Try again.', {
            code: 'transport_failed',
            retryAfterMs: 1500,
            retryLimit: 1,
          });
        }
        if (!response.ok) {
          if (response.status === 401) sessionStorage.removeItem(storageKey);
          const error = await demoProxyError(response);
          throw error;
        }
        signal.throwIfAborted();
        requestSignal.throwIfAborted();
        return completion;
      },
    } satisfies GalleryModelConnection;
  };
