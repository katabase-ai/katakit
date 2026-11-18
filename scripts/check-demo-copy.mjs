import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPnpm as run, withExamplePackages } from './example-test-packages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const selected = args.find(arg => arg !== '--registry');
if (args.some(arg => arg.startsWith('--') && arg !== '--registry'))
  throw new Error('Usage: pnpm demos:copy-check [name] [--registry]');
const names = selected
  ? [selected]
  : readdirSync(join(root, 'examples/demos'), { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
const checkServer = async (cwd, gallery) => {
  const server = spawn(
    process.execPath,
    [
      `${cwd}/node_modules/vite/bin/vite.js`,
      '--host',
      '127.0.0.1',
      '--port',
      '14347',
      '--strictPort',
    ],
    { cwd, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let output = '';
  server.stdout.on('data', data => (output += data));
  server.stderr.on('data', data => (output += data));
  try {
    let response;
    for (let i = 0; i < 300; i++) {
      if (server.exitCode !== null) throw new Error(output);
      try {
        response = await fetch('http://127.0.0.1:14347' + (gallery ? '/demos/transcription' : '/'));
        if (response.ok) break;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!response?.ok) throw new Error(output);
    if (
      response.headers.get('cross-origin-opener-policy') !== 'same-origin' ||
      response.headers.get('cross-origin-embedder-policy') !== 'require-corp'
    )
      throw new Error('Missing isolation headers');
    const asset = await fetch('http://127.0.0.1:14347/transcription-assets/microphone-worklet.js');
    if (!asset.ok || !(await asset.text()).includes('AudioWorkletProcessor'))
      throw new Error('Invalid worklet response');
    if (gallery) {
      // The default skin must work in a copied host, including locally served fonts/licenses.
      for (const file of [
        'inter.woff2',
        'plus-jakarta-sans.woff2',
        'jetbrains-0.ttf',
        'inter-OFL.txt',
        'plus-jakarta-sans-OFL.txt',
        'jetbrains-OFL.txt',
      ]) {
        const font = await fetch(`http://127.0.0.1:14347/fonts/${file}`);
        if (
          !font.ok ||
          font.headers.get('content-type')?.includes('text/html') ||
          (await font.arrayBuffer()).byteLength < 1000
        )
          throw new Error(`Missing gallery font asset: ${file}`);
      }
    }
    console.log(
      `HTTP smoke passed: ${cwd}, document, COOP/COEP, worklet${gallery ? ', fonts/licenses' : ''}`
    );
  } finally {
    if (server.exitCode === null) {
      const stopped = new Promise(resolve => server.once('exit', resolve));
      server.kill('SIGTERM');
      await stopped;
    }
  }
};

await withExamplePackages(
  async useLocalPackages => {
    for (const name of names) {
      const temporary = mkdtempSync(join(tmpdir(), 'katakit-demo-copy-'));
      const target = join(temporary, name);
      try {
        run(root, ['examples:copy', `demos/${name}`, target]);
        useLocalPackages(target);
        run(target, ['install', '--no-frozen-lockfile']);
        run(target, ['build']);
        const manifest = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'));
        if (manifest.scripts.tsc) run(target, ['tsc']);
        run(target, manifest.scripts['test:ci'] ? ['test:ci'] : ['test']);
        const assets = join(
          target,
          'dist',
          ...(name === 'gallery' ? ['client'] : []),
          'transcription-assets'
        );
        if (!existsSync(join(assets, 'microphone-worklet.js')))
          throw new Error(`Missing microphone worklet in ${assets}`);
        if (!readdirSync(assets, { recursive: true }).some(path => path.endsWith('.wasm')))
          throw new Error(`Missing WASM in ${assets}`);
        if (manifest.scripts.dev) await checkServer(target, name === 'gallery');
        console.log(
          `Standalone demo ${name}: install, build, types, tests, and runtime assets passed.`
        );
      } finally {
        rmSync(temporary, { recursive: true, force: true });
      }
    }
  },
  { registry: args.includes('--registry') }
);
