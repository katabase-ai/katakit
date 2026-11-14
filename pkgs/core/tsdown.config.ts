import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    plugin: 'src/plugin.ts',
    katakit: 'src/katakit.ts',
    'utils/reactive/eager': 'src/utils/reactive/eager.ts',
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
