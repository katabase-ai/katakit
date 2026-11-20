import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyPreviewInference } from './verify-preview-inference.mjs';

const proxyUrl = 'https://proxy.example';
const previewOrigin = 'https://pr-42.katakit-preview.katabase.com';
const client = ({ enabled = true, allowedOrigin = previewOrigin } = {}) => {
  const requests = [];
  return {
    requests,
    request: async (url, options) => {
      requests.push({ url, ...options });
      const headers = { 'Access-Control-Allow-Origin': allowedOrigin };
      if (options.method === 'OPTIONS')
        return new Response(null, {
          status: 204,
          headers: { ...headers, 'Access-Control-Allow-Methods': 'POST' },
        });
      return url.pathname === '/config'
        ? Response.json({ enabled, sitekey: 'public-sitekey', action: 'demo_session' }, { headers })
        : Response.json({ error: { code: 'session_required' } }, { status: 401, headers });
    },
  };
};

test('checks the deployed origin without creating sessions or authenticated model requests', async () => {
  const { request, requests } = client();
  await verifyPreviewInference({ proxyUrl, previewOrigin, request });
  assert.equal(requests.length, 4);
  assert.ok(requests.every(request => request.headers.Origin === previewOrigin));
  assert.ok(requests.every(request => !request.headers.Authorization && !request.body));
  assert.ok(
    !requests.some(request => request.method === 'POST' && request.url.pathname === '/session')
  );
});

test('rejects disabled inference, missing CORS, and unrelated preview origins', async () => {
  await assert.rejects(
    verifyPreviewInference({ proxyUrl, previewOrigin, ...client({ enabled: false }) })
  );
  await assert.rejects(
    verifyPreviewInference({ proxyUrl, previewOrigin, ...client({ allowedOrigin: '*' }) })
  );
  await assert.rejects(
    verifyPreviewInference({ proxyUrl, previewOrigin: 'https://localhost', ...client() })
  );
});
