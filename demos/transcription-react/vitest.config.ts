import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'transcription-demo', environment: 'node', include: ['src/**/*.test.ts'] },
});
