import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Demo build configs load packaged runtime assets; unit tests use explicit configs.
    projects: ['pkgs/*', 'demos/*/vitest.config.ts'],
  },
});
