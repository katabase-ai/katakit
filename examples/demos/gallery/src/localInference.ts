import { useEffect, useState } from 'react';
import { GalleryModelError, type GalleryModelConnect } from '../shared/galleryModel';

type Configuration = {
  enabled?: boolean;
  model?: string;
  maxBodyBytes?: number;
  maxOutputTokens?: number;
};
export const localInferenceConnection =
  (config: Configuration, request: typeof fetch = fetch): GalleryModelConnect =>
  async ({ signal }) => {
    signal.throwIfAborted();
    return {
      model: config.model!,
      maxBodyBytes: config.maxBodyBytes!,
      maxOutputTokens: config.maxOutputTokens!,
      requestCompletion: async input => {
        const combined = AbortSignal.any([signal, input.signal]);
        try {
          const response = await request('/__gallery_inference/completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'omit',
            body: input.body,
            signal: combined,
          });
          combined.throwIfAborted();
          if (!response.ok)
            throw new GalleryModelError(
              response.status === 401
                ? 'The provider rejected the server API key. Check OPENROUTER_API_KEY and restart the gallery server.'
                : response.status === 402
                  ? 'The server’s provider account needs credits.'
                  : response.status === 429
                    ? 'The provider is rate limiting requests. Wait, then try again.'
                    : response.status === 413
                      ? 'This request exceeds the local server’s input limit.'
                      : 'The local inference server could not complete this request. Check its environment and try again.',
              { terminal: response.status === 402 }
            );
          return await response.json();
        } catch (error) {
          combined.throwIfAborted();
          if (error instanceof GalleryModelError) throw error;
          throw new GalleryModelError(
            'Could not reach the local inference server. Restart it and try again.'
          );
        }
      },
    };
  };

/** Discover only nonsecret metadata. Developer mode is required; discovery never calls a provider. */
export const useLocalInference = (enabled: boolean) => {
  const [connect, setConnect] = useState<GalleryModelConnect>();
  useEffect(() => {
    setConnect(undefined);
    if (!enabled || !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/__gallery_inference/status', {
          signal: controller.signal,
          credentials: 'omit',
          cache: 'no-store',
        });
        if (!response.ok) return;
        const config: Configuration = await response.json();
        if (
          config.enabled === true &&
          typeof config.model === 'string' &&
          Number.isFinite(config.maxBodyBytes) &&
          config.maxBodyBytes! > 0 &&
          Number.isFinite(config.maxOutputTokens) &&
          config.maxOutputTokens! > 0 &&
          !controller.signal.aborted
        )
          setConnect(() => localInferenceConnection(config));
      } catch {
        /* This host has no local env connection; ordinary configuration stays available. */
      }
    })();
    return () => controller.abort();
  }, [enabled]);
  return enabled ? connect : undefined;
};
