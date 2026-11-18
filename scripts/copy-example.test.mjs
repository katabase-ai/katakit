import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const script = join(root, 'scripts/copy-example.mjs');
const copy = (target, example = 'starters/react-web') =>
  spawnSync(process.execPath, [script, example, target], { encoding: 'utf8' });

test('rejects an existing dangling symlink instead of following or replacing it', () => {
  const temp = mkdtempSync(join(tmpdir(), 'katakit-copy-destination-'));
  try {
    const target = join(temp, 'copy');
    symlinkSync(join(temp, 'missing'), target);
    const result = copy(target);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Destination already exists/);
    assert.equal(readlinkSync(target), join(temp, 'missing'));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('rejects a destination routed into the checkout through a symlinked parent', () => {
  const temp = mkdtempSync(join(tmpdir(), 'katakit-copy-destination-'));
  try {
    symlinkSync(root, join(temp, 'checkout'));
    const target = join(temp, 'checkout', `copy-probe-${process.pid}`);
    const result = copy(target);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /outside this checkout/);
    assert.equal(lstatSync(target, { throwIfNoEntry: false }), undefined);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

for (const example of [
  'starters/react-web',
  'demos/bingo-extension',
  'demos/transcription-react',
  'demos/gallery',
]) {
  test(`copies ${example} with registry dependencies and no bundled packages`, () => {
    const temp = mkdtempSync(join(tmpdir(), 'katakit-copy-destination-'));
    try {
      const target = join(temp, 'nested', 'copy');
      const result = copy(target, example);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(lstatSync(join(target, 'package.json')).isFile());
      assert.equal(
        readFileSync(join(target, 'package.json'), 'utf8'),
        readFileSync(join(root, 'examples', example, 'package.json'), 'utf8')
      );
      assert.equal(existsSync(join(target, 'vendor')), false);
      assert.doesNotMatch(
        readFileSync(join(target, 'pnpm-workspace.yaml'), 'utf8'),
        /overrides:|file:/
      );
      if (example === 'demos/gallery') {
        assert.ok(existsSync(join(target, 'sources/notes-react/src/NotesDemo.tsx')));
        assert.ok(existsSync(join(target, 'styles/components.css')));
        assert.match(readFileSync(join(target, 'shared/gallery.css'), 'utf8'), /\.\.\/styles\//);
      }
      if (example.startsWith('demos/')) {
        const src = join(
          target,
          example === 'demos/gallery' ? 'sources/transcription-react/src' : 'src'
        );
        const names =
          example === 'demos/bingo-extension'
            ? ['bingo/plugin.ts', 'audio-level-meter.css']
            : ['base.css', 'audio-level-meter.css'];
        if (example === 'demos/bingo-extension')
          assert.ok(lstatSync(join(src, 'bingo')).isDirectory());
        for (const name of names) {
          assert.ok(lstatSync(join(src, name)).isFile());
          assert.deepEqual(
            readFileSync(join(src, name)),
            readFileSync(join(root, 'examples/demos/bingo-react/src', name))
          );
        }
      }
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
}

test('export explains a missing required link and rejects unexpected nested links without leaving a partial copy', t => {
  const temp = mkdtempSync(join(tmpdir(), 'katakit-export-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const repo = join(temp, 'repo');
  const scripts = join(repo, 'scripts');
  mkdirSync(scripts, { recursive: true });
  for (const file of ['copy-example.mjs', 'demo-links.mjs'])
    cpSync(join(root, 'scripts', file), join(scripts, file));
  const extension = join(repo, 'examples/demos/bingo-extension');
  const browser = join(repo, 'examples/demos/bingo-react/src');
  mkdirSync(join(extension, 'src'), { recursive: true });
  mkdirSync(join(browser, 'bingo'), { recursive: true });
  writeFileSync(join(extension, 'package.json'), '{}');
  const target = join(temp, 'export');
  const run = () =>
    spawnSync(
      process.execPath,
      [join(scripts, 'copy-example.mjs'), '--demo', 'bingo-extension', target],
      { encoding: 'utf8' }
    );
  assert.match(run().stderr, /must be a symlink.*Enable symlink support/);
  assert.ok(!existsSync(target));
  writeFileSync(join(browser, 'audio-level-meter.css'), '');
  symlinkSync(
    '../../bingo-react/src/audio-level-meter.css',
    join(extension, 'src/audio-level-meter.css'),
    'file'
  );
  symlinkSync('../../bingo-react/src/bingo', join(extension, 'src/bingo'), 'dir');
  symlinkSync('../audio-level-meter.css', join(browser, 'bingo/unexpected'), 'file');
  assert.match(run().stderr, /Unexpected symlink/);
  assert.ok(!existsSync(target));
});
