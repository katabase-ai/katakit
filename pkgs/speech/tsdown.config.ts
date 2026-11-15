import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: ['src/index.ts', 'src/moonshine.ts', 'src/whisper.ts', 'src/whisperWorker.ts'],
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  clean: true,
  deps: { neverBundle: true },
});
