import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { transcriptionAssetsPlugin } from '@katakit/transcription/vite';
import { katakitInference } from './inference/inferencePlugin';

export default defineConfig({
  plugins: [katakitInference(), react(), transcriptionAssetsPlugin({ isolate: true })],
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
});
