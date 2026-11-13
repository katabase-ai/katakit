import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    name: 'react',
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
