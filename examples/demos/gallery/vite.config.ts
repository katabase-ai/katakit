import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { transcriptionAssetsPlugin } from '@katakit/transcription/vite';
import { copyTranscriptionAssets } from '@katakit/transcription/assets';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [
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
});
