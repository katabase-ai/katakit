import { defineConfig } from 'vitest/config';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
  test: {
    name: 'gallery',
    environment: 'node',
    include: ['shared/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
});
