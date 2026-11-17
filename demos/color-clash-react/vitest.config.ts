import { defineConfig } from 'vitest/config';

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
  test: { name: 'color-clash-demo', environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});
