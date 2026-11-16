import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { transcriptionAssetsPlugin } from '@katakit/transcription/vite';

const root = import.meta.dirname;

export default defineConfig({
  plugins: [react(), transcriptionAssetsPlugin()],
  resolve: { conditions: ['source'] },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(root, 'popup.html'),
        sidepanel: resolve(root, 'sidepanel.html'),
        offscreen: resolve(root, 'offscreen.html'),
      },
    },
  },
});
