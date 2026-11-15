import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { speechAssetsPlugin } from '@katakit/speech/vite';

export default defineConfig({
  plugins: [react(), speechAssetsPlugin()],
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
});
