import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
  test: {
    name: 'transcription',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    server: { deps: { inline: ['@katakit/core'] } },
  },
});
