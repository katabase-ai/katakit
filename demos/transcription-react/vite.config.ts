import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { transcriptionAssetsPlugin } from '@katakit/transcription/vite';

export default defineConfig({
  plugins: [react(), transcriptionAssetsPlugin({ isolate: true })],
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
});
