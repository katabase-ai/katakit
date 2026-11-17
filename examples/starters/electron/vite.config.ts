import { defineConfig } from 'vite';
import { transcriptionAssetsPlugin } from '@katakit/transcription/vite';

// Vite requires its configuration as a default export.
// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  base: './',
  plugins: [transcriptionAssetsPlugin({ isolate: true })],
});
