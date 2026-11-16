import { defineConfig } from 'tsdown';

// Keep React and the core package external so consumers own their instances.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'dev-tools': 'src/dev-tools/index.tsx',
    'dev-tools/mount': 'src/dev-tools/mount.ts',
  },
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
