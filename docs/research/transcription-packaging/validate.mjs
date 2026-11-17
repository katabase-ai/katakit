// Check the research report without putting unimplemented APIs in public docs navigation.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../..');
const baseline = '5efcb3134f1b014e15978ac7fb02e31e9400241e';
const report = await readFile(join(directory, 'README.md'), 'utf8');
assert.equal((report.match(/^```/gm) ?? []).length % 2, 0);
let links = 0;
for (const match of report.matchAll(/\]\(([^)]+)\)/g)) {
  const url = match[1];
  if (!url.startsWith('https:')) {
    assert.ok(existsSync(resolve(directory, url.split('#')[0])), `Missing local link: ${url}`);
  } else {
    assert.doesNotThrow(() => new URL(url));
    const path = url.match(
      /^https:\/\/github.com\/katabase-ai\/katakit\/blob\/([a-f\d]{40})\/(.+)$/
    );
    if (path) {
      assert.equal(path[1], baseline);
      execFileSync('git', ['cat-file', '-e', `${path[1]}:${path[2]}`], { cwd: root });
    }
  }
  links++;
}
const req = createRequire(join(root, 'pkgs/transcription/package.json'));
const fixture = await mkdtemp(join(tmpdir(), 'katakit-61-typecheck-'));
try {
  await mkdir(join(fixture, 'node_modules'));
  await symlink(dirname(req.resolve('vite/package.json')), join(fixture, 'node_modules/vite'));
  await copyFile(join(directory, 'proposal-api.d.ts'), join(fixture, 'proposal-api.d.ts'));
  await copyFile(join(directory, 'proposal-example.ts'), join(fixture, 'proposal-example.ts'));
  const blocks = [...report.matchAll(/^```ts\n([\s\S]*?)^```/gm)].map(match => match[1]);
  assert.equal(blocks.length, 2);
  await writeFile(join(fixture, 'vite-example.ts'), blocks[0]);
  await writeFile(
    join(fixture, 'report-example.ts'),
    `
import type {AudioSource, RecognizerStart, SegmentUpdate, RunEnd} from '@katakit/transcription';
declare const source: AudioSource;
declare const run: RecognizerStart;
declare const ingest: {ingestSegment(update: SegmentUpdate): void; endRun(end: RunEnd): void};
${blocks[1]}`
  );
  const tsc = join(
    dirname(createRequire(join(root, 'package.json')).resolve('typescript/package.json')),
    'bin/tsc'
  );
  execFileSync(
    process.execPath,
    [
      tsc,
      '--ignoreConfig',
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--moduleResolution',
      'bundler',
      '--module',
      'esnext',
      '--target',
      'es2022',
      '--lib',
      'es2022,dom',
      'proposal-api.d.ts',
      'proposal-example.ts',
      'vite-example.ts',
      'report-example.ts',
    ],
    { cwd: fixture, stdio: 'inherit' }
  );
  console.log(
    `Validated ${links} report links (local files and pinned Katakit paths), balanced fences, and proposed TypeScript examples.`
  );
  console.log(
    'External HTTP status is not checked here; proposal declarations are not runtime implementations.'
  );
} finally {
  await rm(fixture, { recursive: true, force: true });
}
