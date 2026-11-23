import { defineConfig } from 'tsdown';

// Keep React and the core package external so consumers own their instances.
export default defineConfig({
  entry: ['src/index.ts', 'src/dev-tools.ts'],
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  fixedExtension: false,
  dts: { sourcemap: true },
  sourcemap: true,
  clean: true,
  deps: {
    neverBundle: true,
  },
});
