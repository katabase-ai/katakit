import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkTemplateManifests } from './check-template-manifests.mjs';

test('a standalone manifest with declared registry packages passes', () => {
  const root = mkdtempSync(join(tmpdir(), 'katakit-manifests-'));
  try {
    mkdirSync(join(root, 'example'));
    writeFileSync(
      join(root, 'example/package.json'),
      JSON.stringify({ scripts: { build: 'vite build' }, dependencies: { react: '^19.0.0' } })
    );
    assert.deepEqual(checkTemplateManifests(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('workspace-only dependencies and missing build scripts are reported', () => {
  const root = mkdtempSync(join(tmpdir(), 'katakit-manifests-'));
  try {
    mkdirSync(join(root, 'example'));
    writeFileSync(
      join(root, 'example/package.json'),
      JSON.stringify({ dependencies: { '@katakit/core': 'workspace:*', helper: 'file:../helper' } })
    );
    assert.deepEqual(checkTemplateManifests(root), [
      'example: missing build script',
      'example: dependencies.@katakit/core must use an installable registry version',
      'example: dependencies.helper must use an installable registry version',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
