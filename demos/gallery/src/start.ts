import { createMiddleware, createStart } from '@tanstack/react-start';

const isolation = createMiddleware().server(async ({ next }) => {
  const result = await next();
  result.response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  result.response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  return result;
});

export const startInstance = createStart(() => ({ requestMiddleware: [isolation] }));
