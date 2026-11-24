import { useEffect, useState } from 'react';
import type { GalleryModelConnect } from '../shared/galleryModel';
import { createDemoProxyConnection } from './createDemoProxyConnection';

/** Deployment configuration is independent of the gallery's public/developer UI toggle. */
export const previewInferenceConnection = (
  configuration: { proxyUrl?: string; previewOrigin?: string },
  origin: string
): GalleryModelConnect | undefined => {
  if (!configuration.proxyUrl || !configuration.previewOrigin) return undefined;
  if (!URL.canParse(configuration.previewOrigin) || !URL.canParse(configuration.proxyUrl))
    return undefined;
  const preview = new URL(configuration.previewOrigin);
  const proxy = new URL(configuration.proxyUrl);
  if (
    preview.protocol !== 'https:' ||
    preview.origin !== configuration.previewOrigin ||
    origin !== preview.origin ||
    proxy.protocol !== 'https:' ||
    proxy.origin !== configuration.proxyUrl
  )
    return undefined;
  return createDemoProxyConnection(proxy.origin);
};

/** No discovery, challenge, session creation, or model call runs on mounting the host. */
export const usePreviewInference = () => {
  const [connect, setConnect] = useState<GalleryModelConnect>();
  useEffect(() => {
    const connection = previewInferenceConnection(
      {
        proxyUrl: import.meta.env.VITE_GALLERY_DEMO_PROXY_URL,
        previewOrigin: import.meta.env.VITE_GALLERY_PREVIEW_ORIGIN,
      },
      window.location.origin
    );
    setConnect(() => connection);
  }, []);
  return connect;
};
