import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { moonshineAssetsPlugin } from '../transcription-react/moonshineAssetsPlugin';

const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [react(), moonshineAssetsPlugin()],
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
  server: { headers: isolation },
  preview: { headers: isolation },
});
