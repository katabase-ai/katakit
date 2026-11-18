import { useCallback, useEffect, useMemo, useState } from 'react';
import { NotesRequestError, type NotesConnection } from '../notesModel';
import {
  inferenceRoute,
  type InferenceError,
  type InferenceStatus,
  type InferenceUsage,
} from './inferenceStatus';

export type InferenceUpdate = { status: InferenceStatus; notice?: string };

/** A failed inference route, with the server's safe message and its code. */
export class InferenceRequestError extends Error {
  constructor(
    public code: InferenceError['error']['code'] | 'unavailable',
    message: string
  ) {
    super(message);
  }
}

const call = async <Result>(path: string, init: RequestInit = {}): Promise<Result> => {
  let response: Response;
  try {
    response = await fetch(`${inferenceRoute}${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: init.body ? { 'content-type': 'application/json' } : undefined,
    });
  } catch {
    throw new InferenceRequestError('unavailable', 'The dev server is not responding.');
  }
  const body = (await response.json().catch(() => undefined)) as
    | Result
    | InferenceError
    | undefined;
  if (response.ok && body) return body as Result;
  const error = (body as InferenceError | undefined)?.error;
  throw error
    ? new InferenceRequestError(error.code, error.message)
    : new InferenceRequestError(
        'unavailable',
        'Model setup needs the dev server. Run pnpm dev and open the URL it prints.'
      );
};

/** Calls to this demo's dev server. None of them return a key. */
export const localInference = {
  readStatus: () => call<InferenceStatus>('/status'),
  saveKey: (input: { key?: string; provider?: string; model?: string; endpoint?: string }) =>
    call<InferenceUpdate>('/key', { method: 'POST', body: JSON.stringify(input) }),
  removeKey: () => call<InferenceUpdate>('/key', { method: 'DELETE' }),
  saveModel: (input: { model?: string; upstream?: string }) =>
    call<InferenceUpdate>('/model', { method: 'PUT', body: JSON.stringify(input) }),
  resetUsage: () => call<InferenceUpdate>('/usage', { method: 'DELETE' }),
  signInUrl: (returnPath: string) =>
    `${inferenceRoute}/openrouter/start?return=${encodeURIComponent(returnPath)}`,
};

/**
 * Another attempt cannot fix a rejected key, an empty account, or an unsuitable model, so those
 * are not retried; fixing them in the setup panel changes the connection, which reconnects notes.
 */
const failurePolicy = (code: InferenceRequestError['code']): NotesRequestError['policy'] =>
  code === 'rate_limited'
    ? { retryAfterMs: 5_000, code }
    : code === 'upstream_failed' || code === 'unreachable' || code === 'response_unreadable'
      ? { code }
      : { retryLimit: 0, code };

/**
 * A notes connection backed by the dev server. The server chooses the provider and model, so
 * `model` here is only what the demo reports. `onUsage` receives the server's running totals
 * after every request.
 */
export const connectLocalModel =
  ({ model, onUsage }: { model: string; onUsage?: (usage: InferenceUsage) => void }) =>
  async ({ signal }: { signal: AbortSignal }): Promise<NotesConnection> => {
    signal.throwIfAborted();
    return {
      model,
      maxBodyBytes: 65_536,
      maxOutputTokens: 2048,
      requestCompletion: async ({ body, signal: requestSignal }) => {
        const combined = AbortSignal.any([signal, requestSignal]);
        let response: Response;
        try {
          response = await fetch(`${inferenceRoute}/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'same-origin',
            body,
            signal: combined,
          });
        } catch {
          combined.throwIfAborted();
          throw new NotesRequestError('The dev server is not responding. Is pnpm dev running?', {
            code: 'unavailable',
          });
        }
        const usage = response.headers.get('x-katakit-usage');
        if (usage) onUsage?.(JSON.parse(usage) as InferenceUsage);
        const result = (await response.json().catch(() => undefined)) as unknown;
        if (response.ok) return result;
        const error = (result as InferenceError | undefined)?.error;
        throw new NotesRequestError(
          error?.message ?? 'The model request failed. Try again.',
          failurePolicy(error?.code ?? 'upstream_failed')
        );
      },
    };
  };

/**
 * The dev server's model status for one view, and a notes connection that changes identity
 * whenever the provider, model, or key changes, so in-flight notes stop on any of them.
 */
export const useLocalInference = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const [state, setState] = useState<
    { type: 'loading' } | { type: 'ready'; status: InferenceStatus } | { type: 'unavailable' }
  >({ type: 'loading' });
  const refresh = useCallback(async () => {
    try {
      setState({ type: 'ready', status: await localInference.readStatus() });
    } catch {
      setState({ type: 'unavailable' });
    }
  }, []);
  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);
  const status = state.type === 'ready' ? state.status : undefined;
  const connection = status?.connection;
  const connectionKey = connection && JSON.stringify(connection);
  const connect = useMemo(
    () =>
      connection
        ? connectLocalModel({
            model: connection.model,
            onUsage: usage =>
              setState(current =>
                current.type === 'ready'
                  ? { type: 'ready', status: { ...current.status, usage } }
                  : current
              ),
          })
        : undefined,
    // The serialized connection is the identity; usage updates must not restart notes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connectionKey]
  );
  // The panel that saved a key unmounts once the demo shows its summary; keep the notice here.
  const [notice, setNotice] = useState('');
  const update = useCallback((next: InferenceStatus, message = '') => {
    setState({ type: 'ready', status: next });
    setNotice(message);
  }, []);
  return {
    state,
    status,
    connect: enabled ? connect : undefined,
    refresh,
    update,
    notice,
    setNotice,
  };
};
export type LocalInference = ReturnType<typeof useLocalInference>;
