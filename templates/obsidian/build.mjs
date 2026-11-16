import { build } from 'esbuild';
import { mkdir, copyFile, readFile } from 'node:fs/promises';

// Obsidian exposes a Node-like process in its renderer; force Transformers.js
// to choose the browser ONNX backend rather than its unavailable Node backend.
const browserOnnx = {
  name: 'browser-onnx-in-obsidian',
  setup(build) {
    build.onLoad({ filter: /@xenova\/transformers\/src\/backends\/onnx\.js$/ }, async args => {
      const contents = await readFile(args.path, 'utf8');
      const check = "typeof process !== 'undefined' && process?.release?.name === 'node'";
      if (!contents.includes(check)) throw new Error('Transformers.js backend check changed');
      return { contents: contents.replace(check, 'false'), loader: 'js' };
    });
  },
};

await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  external: ['obsidian'],
  plugins: [browserOnnx],
});
await copyFile('manifest.json', 'dist/manifest.json');
