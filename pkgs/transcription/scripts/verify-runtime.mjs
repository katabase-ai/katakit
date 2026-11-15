import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, build } from 'vite';
import { transcriptionAssetsPlugin } from '../dist/vite.js';
import { listTranscriptionAssets } from '../dist/assets.js';

const fixture = await realpath(await mkdtemp(join(tmpdir(), 'transcription-runtime-')));
let server;
try {
  await writeFile(
    join(fixture, 'index.html'),
    '<!doctype html><title>Transcription runtime check</title>'
  );
  const files = await listTranscriptionAssets();
  for (const file of [
    'whisper-worker.js',
    'microphone-worklet.js',
    'moonshine/index.js',
    'onnx/ort-wasm-simd.wasm',
    'THIRD_PARTY_NOTICES.txt',
  ])
    assert.ok(files.includes(file), `Missing ${file}`);
  assert.ok(files.some(file => file.startsWith('moonshine/') && file.endsWith('.wasm')));
  const worker = await readFile(
    new URL('../dist/assets/whisper-worker.js', import.meta.url),
    'utf8'
  );
  assert.ok(
    !/^import\b.*from\s+["'](?:@xenova|onnxruntime)/m.test(worker),
    'Worker must bundle its runtime dependencies'
  );
  server = await createServer({
    configFile: false,
    root: fixture,
    base: '/nested/',
    plugins: [transcriptionAssetsPlugin({ isolate: true })],
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'error',
  });
  await server.listen();
  const address = server.httpServer.address();
  const base = `http://127.0.0.1:${address.port}/nested/`;
  for (const file of [
    'whisper-worker.js',
    'microphone-worklet.js',
    'moonshine/index.js',
    'moonshine/module.js',
  ]) {
    const response = await fetch(`${base}transcription-assets/${file}`);
    assert.equal(response.status, 200, file);
    assert.match(response.headers.get('content-type'), /javascript/);
    assert.equal(response.headers.get('cross-origin-embedder-policy'), 'require-corp');
    await response.arrayBuffer();
  }
  const wasm = await fetch(`${base}transcription-assets/onnx/ort-wasm-simd.wasm`);
  assert.equal(wasm.headers.get('content-type'), 'application/wasm');
  const reader = wasm.body.getReader();
  assert.deepEqual(Array.from((await reader.read()).value.subarray(0, 4)), [0, 97, 115, 109]);
  await reader.cancel();
  assert.equal((await fetch(base)).headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal((await fetch(`${base}transcription-assets/moonshine/package.json`)).status, 404);
  await server.close();
  server = undefined;
  server = await createServer({
    configFile: false,
    root: fixture,
    base: '/nested/',
    plugins: [transcriptionAssetsPlugin()],
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'error',
  });
  await server.listen();
  const ordinaryAddress = server.httpServer.address();
  const ordinary = await fetch(`http://127.0.0.1:${ordinaryAddress.port}/nested/`);
  assert.equal(ordinary.headers.get('cross-origin-embedder-policy'), null);
  assert.equal(ordinary.headers.get('cross-origin-opener-policy'), null);
  await server.close();
  server = undefined;
  await build({
    configFile: false,
    root: fixture,
    base: '/nested/',
    plugins: [transcriptionAssetsPlugin()],
    logLevel: 'error',
  });
  const copied = await readFile(join(fixture, 'dist/transcription-assets/moonshine/index.js'));
  assert.ok(copied.length > 0);
  assert.ok(
    (await readFile(join(fixture, 'dist/transcription-assets/onnx/ort-wasm-simd.wasm'))).length > 0
  );
  console.log(
    `Verified ${files.length} runtime assets, development headers/MIME types, and production copying under a nested base URL.`
  );
} finally {
  await server?.close();
  await rm(fixture, { recursive: true, force: true });
}
