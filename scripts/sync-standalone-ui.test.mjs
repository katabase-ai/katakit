import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { syncStandaloneUi } from './sync-standalone-ui.mjs';

test('copies whole local files and catches missing or changed copies without editing them', () => {
  const root = mkdtempSync(join(tmpdir(), 'katakit-standalone-ui-'));
  try {
    const canonical = join(root, 'scripts/standalone-ui');
    mkdirSync(canonical, { recursive: true });
    for (const file of ['StandaloneDemo.tsx', 'CaptureControls.tsx', 'standalone.css'])
      writeFileSync(join(canonical, file), `local ${file}`);
    assert.equal(syncStandaloneUi(root, true).length, 17);
    assert.equal(syncStandaloneUi(root).length, 17);
    assert.deepEqual(syncStandaloneUi(root, true), []);
    const target = join(root, 'examples/demos/bingo/src/ui/CaptureControls.tsx');
    writeFileSync(target, 'edited copy');
    assert.deepEqual(syncStandaloneUi(root, true), [
      'examples/demos/bingo/src/ui/CaptureControls.tsx',
    ]);
    assert.equal(readFileSync(target, 'utf8'), 'edited copy');
    assert.equal(syncStandaloneUi(root).length, 1);
    assert.equal(readFileSync(target, 'utf8'), 'local CaptureControls.tsx');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
