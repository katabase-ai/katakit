import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // A static host must fall back to index.html for direct page links.
  base: '/',
});
