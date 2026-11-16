import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { docsExportPlugin } from './scripts/docs-export-plugin.mjs';

export default defineConfig({
  plugins: [docsExportPlugin(), react()],
  // A static host must fall back to index.html for direct page links.
  base: '/',
});
