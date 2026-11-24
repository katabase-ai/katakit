import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
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

for (const example of ['starters/react-web', 'demos/transcription-react', 'gallery']) {
  test(`copies ${example} with registry dependencies and no bundled packages`, () => {
    const temp = mkdtempSync(join(tmpdir(), 'katakit-copy-destination-'));
    try {
      const target = join(temp, 'nested', 'copy');
      const result = copy(target, example);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(lstatSync(join(target, 'package.json')).isFile());
      assert.equal(
        readFileSync(join(target, 'package.json'), 'utf8'),
        readFileSync(
          join(root, example === 'gallery' ? '' : 'examples', example, 'package.json'),
          'utf8'
        )
      );
      assert.equal(existsSync(join(target, 'vendor')), false);
      assert.doesNotMatch(
        readFileSync(join(target, 'pnpm-workspace.yaml'), 'utf8'),
        /overrides:|file:/
      );
      if (example === 'gallery') {
        assert.ok(existsSync(join(target, 'sources/notes-react/src/NotesDemo.tsx')));
        assert.ok(existsSync(join(target, 'sources/brainstorm-react/src/BrainstormDemo.tsx')));
        assert.ok(existsSync(join(target, 'sources/brainstorm-react/src/challenges.json')));
        assert.match(
          readFileSync(join(target, 'shared/BrainstormGalleryDemo.tsx'), 'utf8'),
          /\.\.\/sources\/brainstorm-react\//
        );
        assert.ok(existsSync(join(target, 'styles/components.css')));
        assert.match(readFileSync(join(target, 'shared/gallery.css'), 'utf8'), /\.\.\/styles\//);
      }
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
}
