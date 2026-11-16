import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  external: ['obsidian'],
});
await copyFile('manifest.json', 'dist/manifest.json');
