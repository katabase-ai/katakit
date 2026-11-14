import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Workspace tests exercise current source; package consumers still default to dist.
  resolve: {
    conditions: ['source'],
  },
  ssr: {
    resolve: {
      conditions: ['source'],
    },
  },
  test: {
    name: 'event-log',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    server: {
      deps: {
        inline: ['@katakit/core'],
      },
    },
  },
});
