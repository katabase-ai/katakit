import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
  test: { name: 'bingo-demo', environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
});
