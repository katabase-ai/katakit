import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = import.meta.dirname;
const starter = resolve(root, '../../templates/chrome-extension/public');
const require = createRequire(import.meta.url);
const transformersPath = require.resolve('@xenova/transformers');
const ort = dirname(require.resolve('onnxruntime-web', { paths: [transformersPath] }));

export default defineConfig({
  plugins: [
    react(),
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
        // ONNX runtime's WASM loader must be packaged locally in MV3 extension pages.
        for (const name of readdirSync(ort).filter(file => /^ort-wasm(-simd)?\.wasm$/.test(file))) {
          this.emitFile({
            type: 'asset',
            fileName: `ort/${name}`,
            source: readFileSync(resolve(ort, name)),
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
