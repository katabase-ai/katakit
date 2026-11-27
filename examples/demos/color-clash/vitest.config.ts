import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
  test: { name: 'color-clash-demo', environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});
