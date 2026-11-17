import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { transcriptionAssetsPlugin } from '@katakit/transcription/vite';

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  plugins: [react(), transcriptionAssetsPlugin({ isolate: true })],
  resolve: { conditions: ['source'], dedupe: ['react', 'react-dom'] },
  ssr: { resolve: { conditions: ['source'] } },
});
