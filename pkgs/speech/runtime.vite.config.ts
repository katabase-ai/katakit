import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist/assets',
    emptyOutDir: false,
    lib: {
      entry: {
        'whisper-worker': 'src/runtime/whisper-worker.ts',
        'microphone-worklet': 'src/runtime/microphone-worklet.ts',
      },
      formats: ['es'],
      fileName: (_format, entry) => `${entry}.js`,
    },
    // All worker code is emitted in this asset directory; no app-authored worker entry.
    rollupOptions: { output: { entryFileNames: '[name].js', chunkFileNames: '[name]-[hash].js' } },
  },
});
