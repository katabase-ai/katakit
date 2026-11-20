import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { galleryPreviewUrl } from './preview-comment.mjs';

/** Check real browser admission without creating a session or spending inference allowance. */
export const verifyPreviewInference = async ({ proxyUrl, previewOrigin, request = fetch }) => {
  const proxy = new URL(proxyUrl);
  assert.equal(proxy.protocol, 'https:');
  assert.equal(proxy.origin, proxyUrl);
  assert.match(previewOrigin, /^https:\/\/pr-[1-9]\d*\.katakit-preview\.katabase\.com$/);
  const send = (path, options = {}) =>
    request(new URL(path, proxy), {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: { ...options.headers, Origin: previewOrigin },
    });
  const configResponse = await send('/config');
  assert.equal(configResponse.status, 200, 'Proxy must accept this preview origin');
  assert.equal(configResponse.headers.get('Access-Control-Allow-Origin'), previewOrigin);
  const config = await configResponse.json();
  assert.equal(config.enabled, true, 'Managed inference must be enabled');
  assert.ok(config.sitekey, 'A Turnstile sitekey is required');
  assert.equal(config.action, 'demo_session');
  for (const path of ['/session', '/v1/chat/completions']) {
    const preflight = await send(path, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), previewOrigin);
    assert.equal(preflight.headers.get('Access-Control-Allow-Methods'), 'POST');
  }
  const rejected = await send('/v1/chat/completions', { method: 'POST' });
  assert.equal(rejected.status, 401, 'Model requests must still require a session');
  assert.equal(rejected.headers.get('Access-Control-Allow-Origin'), previewOrigin);
  assert.equal((await rejected.json()).error.code, 'session_required');
};

if (import.meta.main) {
  const previewOrigin = galleryPreviewUrl(
    readFileSync(process.argv[2], 'utf8'),
    process.env.PR_NUMBER
  );
  assert.equal(
    previewOrigin,
    `https://pr-${process.env.PR_NUMBER}.katakit-preview.katabase.com`,
    'Uploaded alias must match the origin compiled into the gallery'
  );
  await verifyPreviewInference({ proxyUrl: process.env.PROXY_URL, previewOrigin });
  console.info(
    'Preview inference origin, preflights and credential requirement verified. No paid calls.'
  );
}
