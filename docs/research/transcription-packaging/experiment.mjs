// Research fixture only. Builds/packs the existing package; never edits its manifest.
// Run from the repository root after pnpm install --frozen-lockfile.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const pkg = join(root, 'pkgs/transcription');
const baseline = '5efcb3134f1b014e15978ac7fb02e31e9400241e';
// The report's measurements are only comparable when the measured package and
// build inputs still match the pinned baseline. The research docs themselves
// may be committed on top of that revision.
const inputs = [
  'pkgs/transcription',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'package.json',
  '.npmrc',
];
const changedInputs = execFileSync('git', ['diff', '--name-only', baseline, '--', ...inputs], {
  cwd: root,
  encoding: 'utf8',
}).trim();
assert.equal(
  changedInputs,
  '',
  `Packaging inputs differ from ${baseline}; reproduce the recorded measurements on the pinned baseline instead:\n${changedInputs}`
);
const scratch = await realpath(await mkdtemp(join(tmpdir(), 'katakit-61-')));
const run = (cmd, args, cwd = scratch) => {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    process.stderr.write(error.stdout ?? '');
    process.stderr.write(error.stderr ?? '');
    throw error;
  }
};
const json = async (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const files = async (directory, prefix = '') => {
  const rows = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    // Count regular file bytes, without dependency symlinks or nested node_modules.
    if (entry.name === 'node_modules') continue;
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) rows.push(...(await files(directory, name)));
    else if (entry.isFile()) rows.push({ name, bytes: (await stat(join(directory, name))).size });
  }
  return rows.toSorted((a, b) => a.name.localeCompare(b.name));
};
const sum = rows => rows.reduce((total, row) => total + row.bytes, 0);
const closure = async start => {
  const visited = new Map();
  const missing = [];
  const packageRoot = async (req, name) => {
    try {
      return dirname(req.resolve(`${name}/package.json`));
    } catch {
      let directory = dirname(req.resolve(name));
      while (dirname(directory) !== directory) {
        try {
          if (JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')).name === name)
            return directory;
        } catch {
          /* Walk to the dependency root when its exports hide package.json. */
        }
        directory = dirname(directory);
      }
      throw new Error(`Package root not found: ${name}`);
    }
  };
  const visit = async directory => {
    directory = await realpath(directory);
    if (visited.has(directory)) return;
    const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    visited.set(directory, {
      name: manifest.name,
      version: manifest.version,
      bytes: sum(await files(directory)),
    });
    const req = createRequire(join(directory, 'package.json'));
    for (const name of new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
    ])) {
      try {
        await visit(await packageRoot(req, name));
      } catch (error) {
        missing.push({ from: manifest.name, name, code: error.code });
      }
    }
  };
  await visit(start);
  const packages = [...visited.values()].toSorted((a, b) => b.bytes - a.bytes);
  return { packages, missing, totalBytes: sum(packages) };
};

try {
  run('pnpm', ['pack', '--pack-destination', scratch], pkg);
  const archive = join(scratch, 'katakit-transcription-0.0.0.tgz');
  const consumer = join(scratch, 'consumer');
  await mkdir(consumer);
  await json(join(consumer, 'package.json'), { private: true, type: 'module' });
  run(
    'npm',
    ['install', archive, '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'],
    consumer
  );
  const installed = join(consumer, 'node_modules/@katakit/transcription');
  const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  assert.deepEqual(manifest.dependencies ?? {}, {});
  assert.ok(
    Object.values(manifest.exports).every(
      value => typeof value !== 'object' || !('source' in value)
    )
  );
  const tree = JSON.parse(run('npm', ['ls', '--all', '--omit=dev', '--json'], consumer));
  delete tree.dependencies['@katakit/transcription'].resolved;
  assert.equal(existsSync(join(consumer, 'node_modules/react')), false);
  assert.equal(existsSync(join(consumer, 'node_modules/vite')), false);
  await writeFile(
    join(consumer, 'smoke.mjs'),
    `
import assert from 'node:assert/strict';
import { createTranscriber } from '@katakit/transcription';
import { createBrowserTranscriber } from '@katakit/transcription/browser';
const results = [];
const speech = createTranscriber({
  engine: async events => ({start() {}, write() {}, stop() {events.onFinal({id:'1',sourceId:'node',text:'done'});},close() {}}),
  onFinal: result => results.push(result),
});
await speech.start({sourceId:'node'}); await speech.stop(); await speech.dispose();
assert.equal(results[0].text, 'done');
const browser = createBrowserTranscriber({model:'whisper-tiny',onFinal() {}});
await assert.rejects(browser.load(), {code:'unsupported-environment'});
await browser.dispose();
`
  );
  run(process.execPath, ['smoke.mjs'], consumer);
  const report = await readFile(join(dirname(fileURLToPath(import.meta.url)), 'README.md'), 'utf8');
  const baselineExample = report.match(/^```js\n([\s\S]*?)^```/m)?.[1];
  assert.ok(baselineExample, 'Expected one supported-baseline JS example in the report');
  await writeFile(join(consumer, 'baseline-example.mjs'), baselineExample);
  run(process.execPath, ['baseline-example.mjs'], consumer);
  const all = await files(installed);
  const assets = [];
  for (const row of all.filter(row => row.name.startsWith('dist/assets/'))) {
    assets.push({
      ...row,
      sha256: createHash('sha256')
        .update(await readFile(join(installed, row.name)))
        .digest('hex'),
    });
  }
  const req = createRequire(join(pkg, 'package.json'));
  // Read manifests from the shipped WASM without constructing a recognizer or fetching weights.
  // A file entry avoids inheriting --input-type into Emscripten's Node worker threads.
  await writeFile(
    join(scratch, 'manifests.mjs'),
    `
import {loadMoonshineModule} from ${JSON.stringify(pathToFileURL(join(installed, 'dist/assets/moonshine/module.js')).href)};
const module = await loadMoonshineModule();
console.log(JSON.stringify(Object.fromEntries(['2','4','5'].map(arch => [arch, JSON.parse(module.sttDependencies('en',arch,false))]))));
process.exit(0);
`
  );
  const moonshineModelManifests = JSON.parse(run(process.execPath, ['manifests.mjs']));
  const { build } = await import(pathToFileURL(req.resolve('vite')).href);
  const { transcriptionAssetsPlugin } = await import(
    pathToFileURL(join(installed, 'dist/vite.js')).href
  );
  const bundles = [];
  for (const [name, source, copy] of [
    [
      'base',
      "import {createTranscriber} from '@katakit/transcription'; globalThis.fixture = createTranscriber;",
      false,
    ],
    [
      'browser',
      "import {createBrowserTranscriber} from '@katakit/transcription/browser'; globalThis.fixture = () => createBrowserTranscriber({model:'whisper-tiny',onFinal:console.log});",
      false,
    ],
    [
      'browser-with-assets',
      "import {createBrowserTranscriber} from '@katakit/transcription/browser'; globalThis.fixture = () => createBrowserTranscriber({model:'whisper-tiny',onFinal:console.log});",
      true,
    ],
  ]) {
    await writeFile(join(consumer, 'main.js'), source);
    await writeFile(
      join(consumer, 'index.html'),
      '<script type="module" src="./main.js"></script>'
    );
    await build({
      configFile: false,
      root: consumer,
      logLevel: 'silent',
      plugins: copy ? [transcriptionAssetsPlugin()] : [],
      build: { outDir: join(consumer, name), minify: true },
    });
    const output = await files(join(consumer, name));
    bundles.push({
      name,
      files: output.length,
      totalBytes: sum(output),
      appJsBytes: sum(
        output.filter(row => row.name.startsWith('assets/') && row.name.endsWith('.js'))
      ),
      copiedAssetBytes: sum(output.filter(row => row.name.startsWith('transcription-assets/'))),
    });
  }

  // Tiny local packages establish install semantics, not hypothetical provider sizes.
  for (const name of ['fixture-provider-a', 'fixture-provider-b']) {
    const directory = join(scratch, name);
    await mkdir(directory);
    await json(join(directory, 'package.json'), { name, version: '1.0.0', main: 'index.js' });
    await writeFile(join(directory, 'index.js'), 'module.exports = 1;\n');
    run('npm', ['pack', '--ignore-scripts', '--pack-destination', scratch], directory);
  }
  const optional = [];
  for (const omit of [false, true]) {
    const directory = join(scratch, `optional-${omit}`);
    await mkdir(directory);
    await json(join(directory, 'package.json'), {
      private: true,
      optionalDependencies: Object.fromEntries(
        ['a', 'b'].map(letter => [
          `fixture-provider-${letter}`,
          `file:${join(scratch, `fixture-provider-${letter}-1.0.0.tgz`)}`,
        ])
      ),
    });
    run(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--offline',
        '--no-audit',
        '--no-fund',
        '--package-lock=false',
        ...(omit ? ['--omit=optional'] : []),
      ],
      directory
    );
    const present = ['a', 'b'].filter(letter =>
      existsSync(join(directory, `node_modules/fixture-provider-${letter}`))
    );
    assert.equal(present.length, omit ? 0 : 2);
    optional.push({ omitOptional: omit, installed: present });
  }
  const results = {
    baseline,
    environment: {
      node: process.version,
      pnpm: run('pnpm', ['--version'], root),
      npm: run('npm', ['--version']),
      platform: process.platform,
      arch: process.arch,
    },
    package: {
      archiveBytes: (await stat(archive)).size,
      unpackedBytes: sum(all),
      files: all.length,
      exports: Object.keys(manifest.exports),
      dependencies: manifest.dependencies ?? {},
      optionalPeers: manifest.peerDependenciesMeta,
      installedTree: tree.dependencies,
    },
    assets,
    moonshineModelManifests,
    bundles,
    providerDevelopmentClosures: {
      moonshine: await closure(join(pkg, 'node_modules/@moonshine-ai/moonshine-wasm')),
      transformers: await closure(join(pkg, 'node_modules/@xenova/transformers')),
    },
    optionalDependencyFixture: optional,
    assertions: [
      'packed exports have no source condition',
      'clean npm install has no required runtime dependencies',
      'base engine runs in Node',
      'browser model load fails clearly in Node',
      'optional dependencies install by default and are omitted together',
    ],
  };
  const output = process.argv[2];
  if (output) await json(resolve(output), results);
  else console.log(JSON.stringify(results, null, 2));
} finally {
  await rm(scratch, { recursive: true, force: true });
}
