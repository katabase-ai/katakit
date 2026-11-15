import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { speechAssetsPlugin } from '@katakit/speech/vite';

const root = import.meta.dirname;
const starter = resolve(root, '../../templates/chrome-extension/public');

export default defineConfig({
  plugins: [
    react(),
    speechAssetsPlugin(),
    {
      name: 'extension-host-assets',
      generateBundle() {
        for (const name of ['background.js', 'pcm-worklet.js']) {
          this.emitFile({
            type: 'asset',
            fileName: name,
            source: readFileSync(resolve(starter, name)),
          });
        }
      },
    },
  ],
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
