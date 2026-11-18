import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { transcriptionAssetsPlugin } from '@katakit/transcription/vite';
import { copyTranscriptionAssets } from '@katakit/transcription/assets';
import { resolve } from 'node:path';
import { katakitInference } from '../notes-react/inference/inferencePlugin';

export default defineConfig({
  plugins: [
    // First, so its dev-server routes answer before Start and the Workers runtime.
    katakitInference(),
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
