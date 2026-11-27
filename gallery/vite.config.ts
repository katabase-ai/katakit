import { defineConfig, loadEnv } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { transcriptionAssetsPlugin } from '@katakit/transcription/vite';
import { copyTranscriptionAssets } from '@katakit/transcription/assets';
import { resolve } from 'node:path';
import { localInferenceProxy } from './localInferenceProxy';

export default defineConfig(({ mode }) => ({
  plugins: [
    {
      name: 'gallery-dev-client-entry',
      configureServer(server) {
        // Start emits the bare virtual ID in dev HTML. Serve Vite's resolved
        // virtual module URL so the request doesn't fall through to an SSR 404.
        server.middlewares.use((request, _response, next) => {
          request.url = request.url?.replace(
            /^\/@id\/virtual:tanstack-start-client-entry(?=\?|$)/,
            '/@id/__x00__virtual:tanstack-start-client-entry'
          );
          next();
        });
      },
    },
    localInferenceProxy(() => loadEnv(mode, import.meta.dirname, '')),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    react(),
    // Start separates client/server output. Reuse the utility's dev server and copy API
    // rather than relying on a single-output Vite plugin to choose the client directory.
    { ...transcriptionAssetsPlugin({ isolate: true }), apply: 'serve' },
    {
      name: 'gallery-transcription-assets',
      closeBundle: () =>
        copyTranscriptionAssets(resolve(import.meta.dirname, 'dist/client/transcription-assets')),
    },
  ],
  resolve: { conditions: ['source'], dedupe: ['react', 'react-dom'] },
  ssr: { resolve: { conditions: ['source'] } },
}));
