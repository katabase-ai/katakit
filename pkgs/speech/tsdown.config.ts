import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: [
    'src/index.ts',
    'src/moonshine.ts',
    'src/whisper.ts',
    'src/browser.ts',
    'src/assets.ts',
    'src/vite.ts',
  ],
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  clean: true,
  deps: { neverBundle: true },
});
