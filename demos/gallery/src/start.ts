import { createMiddleware, createStart } from '@tanstack/react-start';

const isolation = createMiddleware().server(async ({ next }) => {
  const result = await next();
  result.response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  result.response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  // Model hosts can reject preview-host referrers; asset requests need no page URL.
  result.response.headers.set('Referrer-Policy', 'no-referrer');
  return result;
});

export const startInstance = createStart(() => ({ requestMiddleware: [isolation] }));
