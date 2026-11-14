import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/plugin.ts'],
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  fixedExtension: false,
  dts: true,
  clean: true,
  deps: {
    neverBundle: true,
  },
});
