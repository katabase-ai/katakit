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
    writeFileSync(join(root, 'example/README.md'), '# Example');
    writeFileSync(join(root, 'example/LICENSE'), 'test fixture');
    writeFileSync(
      join(root, 'example/package.json'),
      JSON.stringify({
        scripts: { build: 'vite build' },
        dependencies: { react: '^19.0.0', '@katakit/core': '0.0.0' },
      })
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
    writeFileSync(join(root, 'example/README.md'), '# Example');
    writeFileSync(join(root, 'example/LICENSE'), 'test fixture');
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

test('Katakit dependencies must use registry versions even when a tarball exists', () => {
  const root = mkdtempSync(join(tmpdir(), 'katakit-manifests-'));
  try {
    mkdirSync(join(root, 'example'));
    writeFileSync(join(root, 'example/README.md'), '# Example');
    writeFileSync(join(root, 'example/LICENSE'), 'test fixture');
    mkdirSync(join(root, 'example/vendor'));
    writeFileSync(join(root, 'example/vendor/katakit-core-0.0.0.tgz'), 'test fixture');
    writeFileSync(
      join(root, 'example/package.json'),
      JSON.stringify({
        scripts: { build: 'tsc --noEmit' },
        dependencies: {
          '@katakit/core': 'file:vendor/katakit-core-0.0.0.tgz',
          '@katakit/transcript-ingestion': 'file:vendor/missing.tgz',
          rxjs: 'file:vendor/katakit-core-0.0.0.tgz',
        },
      })
    );
    assert.deepEqual(checkTemplateManifests(root), [
      'example: dependencies.@katakit/core must use an installable registry version',
      'example: dependencies.@katakit/transcript-ingestion must use an installable registry version',
      'example: dependencies.rxjs must use an installable registry version',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a copied template must include its own README and license', () => {
  const root = mkdtempSync(join(tmpdir(), 'katakit-manifests-'));
  try {
    mkdirSync(join(root, 'example'));
    writeFileSync(
      join(root, 'example/package.json'),
      JSON.stringify({ scripts: { build: 'true' } })
    );
    assert.deepEqual(checkTemplateManifests(root), [
      'example: missing README.md',
      'example: missing LICENSE',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('registry dependencies cannot be redirected by shipped overrides', () => {
  const root = mkdtempSync(join(tmpdir(), 'katakit-manifests-'));
  try {
    mkdirSync(join(root, 'example'));
    writeFileSync(join(root, 'example/README.md'), '# Example');
    writeFileSync(join(root, 'example/LICENSE'), 'test fixture');
    const manifest = {
      scripts: { build: 'vite build' },
      dependencies: { '@katakit/core': '0.0.0' },
    };
    for (const extra of [
      { overrides: { '@katakit/core': 'file:vendor/core.tgz' } },
      { pnpm: { overrides: { '@katakit/core': 'file:vendor/core.tgz' } } },
      {},
    ]) {
      writeFileSync(join(root, 'example/package.json'), JSON.stringify({ ...manifest, ...extra }));
      if (!Object.keys(extra).length) {
        writeFileSync(
          join(root, 'example/pnpm-workspace.yaml'),
          "overrides:\n  '@katakit/core': file:vendor/core.tgz\n"
        );
      }
      assert.deepEqual(checkTemplateManifests(root), [
        'example: dependency overrides belong only in disposable test copies',
      ]);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
