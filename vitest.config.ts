import { readdirSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Select only directories: pkgs/ also contains AGENTS.md, which is not a Vitest config.
    // Demo build configs load packaged runtime assets; unit tests use explicit configs.
    projects: [
      ...readdirSync(new URL('./pkgs/', import.meta.url), { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => `pkgs/${entry.name}`),
      'demos/*/vitest.config.ts',
    ],
  },
});
