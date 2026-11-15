import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/models/index.ts', 'src/models/whisperWorker.ts'],
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  clean: true,
  deps: { neverBundle: true },
});
