import { defineConfig } from 'vitest/config';
import UnoCSS from 'unocss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [UnoCSS({ configFile: fileURLToPath(new URL('./uno.config.mjs', import.meta.url)) })],
  build: {
    target: 'es2022',
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'index.js' },
    sourcemap: true,
    cssMinify: false,
    rollupOptions: {
      external: [
        /^(?:react|react-dom|react-resizable|rxjs|@base-ui\/react|@jridgewell\/trace-mapping)(?:\/|$)/,
      ],
    },
  },
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
