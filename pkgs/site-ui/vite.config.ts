import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'site-ui', environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});
