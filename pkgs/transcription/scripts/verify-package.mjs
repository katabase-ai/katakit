import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixture = await mkdtemp(join(tmpdir(), 'transcription-package-'));
const run = (command, args, cwd = fixture) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
try {
  run('pnpm', ['pack', '--pack-destination', fixture], root);
  const source = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const archive = `${source.name.replace(/^@/, '').replace('/', '-')}-${source.version}.tgz`;
  const directory = join(fixture, 'node_modules/@katakit/transcription');
  await mkdir(directory, { recursive: true });
  run('tar', ['-xf', join(fixture, archive), '-C', directory, '--strip-components=1']);
  const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  assert.deepEqual(manifest.dependencies ?? {}, {});
  for (const entry of Object.values(manifest.exports))
    if (typeof entry === 'object') assert.ok(!('source' in entry));
  await writeFile(join(fixture, 'package.json'), '{"type":"module"}');
  await writeFile(
    join(fixture, 'smoke.mjs'),
    `
import assert from 'node:assert/strict';
import { createTranscriber } from '@katakit/transcription';
import { createMicrophoneTranscriber, createBrowserTranscriber } from '@katakit/transcription/browser';
import { moonshine } from '@katakit/transcription/moonshine';
import { whisper } from '@katakit/transcription/whisper';
import { copyTranscriptionAssets } from '@katakit/transcription/assets';
const results = [];
const input = createTranscriber({
  engine: async events => ({ start() {}, write() {}, stop() { events.onFinal({id:'1',sourceId:'test',text:'done'}); }, close() {} }),
  onFinal: result => results.push(result),
});
await input.start(); await input.stop(); await input.dispose();
assert.equal(results[0].text, 'done');
for (const factory of [createMicrophoneTranscriber, createBrowserTranscriber, moonshine, whisper]) assert.equal(typeof factory, 'function');
await copyTranscriptionAssets('./public/transcription-assets');
`
  );
  for (const args of [[], ['--conditions=source']]) run(process.execPath, [...args, 'smoke.mjs']);
  const require = createRequire(import.meta.url);
  const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc');
  const headless = `import { createTranscriber, type TranscriptionEngine } from '@katakit/transcription';
const engine: TranscriptionEngine = async events => ({start(sourceId) {}, write(audio, rate) {}, stop() {}, close() {}});
const speech = createTranscriber({engine,onFinal: segment => { const text: string = segment.text; }});
await speech.start({sourceId:'node'}); await speech.dispose();`;
  const browser = `import { createMicrophoneTranscriber } from '@katakit/transcription/browser';
import { moonshine } from '@katakit/transcription/moonshine';
const input = createMicrophoneTranscriber({model:'whisper-tiny',onFinal: segment => {},onState: state => { const code: string | undefined = state.error?.code; }});
await input.start(); await input.stop(); await input.dispose();`;
  for (const [name, content, libs] of [
    ['headless', headless, 'es2022'],
    ['browser', browser, 'es2022,dom'],
  ]) {
    await writeFile(join(fixture, `${name}.ts`), content);
    for (const resolution of ['bundler', 'nodenext'])
      run(process.execPath, [
        tsc,
        '--ignoreConfig',
        '--noEmit',
        '--strict',
        '--target',
        'es2022',
        '--lib',
        libs,
        '--moduleResolution',
        resolution,
        '--module',
        resolution === 'bundler' ? 'esnext' : 'nodenext',
        '--customConditions',
        'source',
        `${name}.ts`,
      ]);
  }
  assert.ok(
    (await readFile(join(fixture, 'public/transcription-assets/onnx/ort-wasm-simd.wasm'))).length >
      0
  );
  console.log(
    'Packed package runs and typechecks without React, RxJS, provider SDKs, workspace aliases, or DOM types for the base API.'
  );
} finally {
  await rm(fixture, { recursive: true, force: true });
}
