import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { transcriptionAssetsPlugin } from '@katakit/transcription/vite';

export default defineConfig({
  plugins: [transcriptionAssetsPlugin()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, 'popup.html'),
        sidepanel: resolve(import.meta.dirname, 'sidepanel.html'),
        offscreen: resolve(import.meta.dirname, 'offscreen.html'),
      },
    },
  },
});
