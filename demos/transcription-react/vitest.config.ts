import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { conditions: ['source'] },
  test: { name: 'transcription-demo', environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});
