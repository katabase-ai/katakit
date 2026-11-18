import { GalleryModelError, type GalleryModelConnect } from './galleryModel';

export const inferenceStorageKey = 'katakit.gallery.inference.v1';
export const defaultInference = {
  source: 'free' as 'free' | 'key',
  key: '',
  model: 'z-ai/glm-5.3',
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
};
export type GalleryInference = typeof defaultInference;

export const validateInference = (input: GalleryInference): GalleryInference => {
  const settings = {
    source: input.source,
    key: input.key.trim(),
    model: input.model.trim(),
    endpoint: input.endpoint.trim(),
  };
  if (!['free', 'key'].includes(settings.source)) throw new Error('Choose an inference source.');
  if (settings.source === 'key' && !settings.key) throw new Error('Enter an OpenRouter API key.');
  if (/[\r\n]/.test(settings.key)) throw new Error('Enter a valid API key.');
  if (!settings.model) throw new Error('Enter a model ID.');
  let url: URL;
  try {
    url = new URL(settings.endpoint);
  } catch {
    throw new Error('Enter a full chat-completions endpoint URL.');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    !(url.protocol === 'https:' || (local && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      'Use HTTPS (or local HTTP), with no credentials, query, or fragment in the URL.'
    );
  return settings;
};

/** One root-owned source lifetime, including changes made in another tab. No network on save. */
export const createGalleryInference = (
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
) => {
  const read = (): GalleryInference => {
    try {
      const saved: unknown = JSON.parse(storage.getItem(inferenceStorageKey) ?? 'null');
      if (typeof saved !== 'object' || !saved) return { ...defaultInference };
      const value = saved as Record<string, unknown>;
      if (
        typeof value.key !== 'string' ||
        typeof value.model !== 'string' ||
        typeof value.endpoint !== 'string' ||
        (value.source !== 'free' && value.source !== 'key')
      )
        return { ...defaultInference };
      return validateInference(value as GalleryInference);
    } catch {
      return { ...defaultInference };
    }
  };
  let settings = read();
  let lifetime = new AbortController();
  const listeners = new Set<() => void>();
  const replace = (next: GalleryInference) => {
    lifetime.abort();
    lifetime = new AbortController();
    settings = next;
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => settings,
    getSignal: () => lifetime.signal,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    save: (next: GalleryInference) => {
      const validated = validateInference(next);
      try {
        storage.setItem(inferenceStorageKey, JSON.stringify(validated));
      } catch {
        throw new Error(
          'Could not save settings in this browser. Allow local storage and try again.'
        );
      }
      replace(validated);
    },
    remove: () => {
      try {
        storage.removeItem(inferenceStorageKey);
      } catch {
        throw new Error('Could not remove the saved key. Allow local storage and try again.');
      }
      replace({ ...defaultInference });
    },
    reload: () => replace(read()),
    /** Pause a source lifetime without changing or persisting developer settings. */
    invalidate: () => replace(settings),
    dispose: () => {
      lifetime.abort();
      listeners.clear();
    },
  };
};

/** Visitor-owned chat-completions transport. Never touches host admission or allowance. */
export const connectWithKey =
  (
    settings: GalleryInference,
    sourceSignal: AbortSignal,
    request: typeof fetch = fetch
  ): GalleryModelConnect =>
  async ({ signal }) => {
    const config = validateInference(settings);
    const lifetime = AbortSignal.any([signal, sourceSignal]);
    lifetime.throwIfAborted();
    return {
      model: config.model,
      maxBodyBytes: 65_536,
      maxOutputTokens: 2048,
      requestCompletion: async ({ body, signal: requestSignal }) => {
        const combined = AbortSignal.any([lifetime, requestSignal]);
        combined.throwIfAborted();
        try {
          const response = await request(config.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` },
            body,
            signal: combined,
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            redirect: 'error',
          });
          combined.throwIfAborted();
          if (!response.ok) {
            const message =
              response.status === 401 || response.status === 403
                ? 'The provider rejected your key. Check it in Inference settings.'
                : response.status === 402
                  ? 'Your provider account needs credits. Check your provider account or choose Free demo.'
                  : response.status === 429
                    ? 'The provider is rate limiting requests. Wait, then start notes again.'
                    : response.status === 400 || response.status === 404 || response.status === 422
                      ? 'Check the model ID and structured-output support in Configure models, and the endpoint under Advanced.'
                      : 'The provider could not complete this request. Start notes again when ready.';
            throw new GalleryModelError(message);
          }
          const result: unknown = await response.json();
          combined.throwIfAborted();
          return result;
        } catch (error) {
          combined.throwIfAborted();
          if (error instanceof GalleryModelError) throw error;
          // Do not surface provider bodies or native fetch errors: either can contain credentials/URLs.
          throw new GalleryModelError(
            'Could not reach the model. Check your endpoint, network, and browser access (CORS), then start notes again.'
          );
        }
      },
    };
  };
