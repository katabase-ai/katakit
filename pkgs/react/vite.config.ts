import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
  test: {
    name: 'react',
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
    server: { deps: { inline: ['@katakit/core'] } },
  },
});
