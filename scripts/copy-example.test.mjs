import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdtempSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const script = join(root, 'scripts/copy-example.mjs');
const copy = target =>
  spawnSync(process.execPath, [script, 'starters/react-web', target], { encoding: 'utf8' });

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

test('copies a starter to a new external directory', () => {
  const temp = mkdtempSync(join(tmpdir(), 'katakit-copy-destination-'));
  try {
    const target = join(temp, 'nested', 'copy');
    const result = copy(target);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(lstatSync(join(target, 'package.json')).isFile());
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
