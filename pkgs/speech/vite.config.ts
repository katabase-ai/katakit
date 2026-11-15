import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
  test: {
    name: 'speech',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
