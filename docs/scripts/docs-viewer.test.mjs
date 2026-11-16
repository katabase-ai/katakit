import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageHref } from '../src/docsBundle.ts';
import { isDocsInput, queueDocsExport } from './docs-export-plugin.mjs';

const bundle = {
  navigation: [],
  pages: {
    'reference/plugins': { file: 'content/reference/plugins.md', markdown: '' },
    'api/core/type-aliases/KatakitPlugin': {
      file: 'content/api/core/type-aliases/KatakitPlugin.md',
      markdown: '',
    },
    'api/event-log/functions/makeEventLogPlugin': {
      file: 'content/api/event-log/functions/makeEventLogPlugin.md',
      markdown: '',
    },
  },
  assets: { 'content/assets/example.svg': '/assets/example-hash.svg' },
};

test('viewer resolves exported landing pages, cross-package references, and assets', () => {
  const slug = 'api/event-log/functions/makeEventLogPlugin';
  const href = href => pageHref({ href, slug, bundle });
  assert.equal(
    href('../../core/type-aliases/KatakitPlugin.md#configuration'),
    '/api/core/type-aliases/KatakitPlugin#configuration'
  );
  assert.equal(href('../../../reference/plugins.md'), '/reference/plugins');
  assert.equal(href('../../../assets/example.svg'), '/assets/example-hash.svg');
  assert.equal(href('#methods'), '#methods');
  assert.equal(
    href('https://github.com/katabase-ai/katakit'),
    'https://github.com/katabase-ai/katakit'
  );
  assert.throws(() => href('./missing.md'), /Missing exported target/);
});

test('source watching includes documentation and declaration inputs but excludes build output', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  for (const path of [
    'docs/pages/concepts/README.md',
    'docs/public/image.svg',
    'pkgs/core/src/plugin.ts',
    'pkgs/core/package.json',
    'pkgs/docs-export/renderPluginReference.mjs',
    'docs/scripts/generate-nav.mjs',
    'pnpm-lock.yaml',
  ]) {
    assert.equal(isDocsInput(resolve(root, path)), true, path);
  }
  for (const path of [
    '.tmp/docs-viewer/manifest.json',
    'dist/docs/content/api/core.md',
    'docs/dist/assets/main.js',
    'pkgs/core/dist/index.js',
    'docs/src/style.css',
  ]) {
    assert.equal(isDocsInput(resolve(root, path)), false, path);
  }
});

test('edits during an export are serialized, coalesced, and recover after a failed export', async () => {
  let finish;
  let started;
  let builds = 0;
  const errors = [];
  const waitForBuild = () =>
    new Promise(resolve => {
      started = resolve;
    });
  const queue = queueDocsExport({
    delay: 0,
    build: async () => {
      builds += 1;
      const blocked = new Promise(resolve => {
        finish = resolve;
      });
      started();
      await blocked;
      if (builds === 1) throw new Error('invalid JSDoc');
    },
    onError: error => errors.push(error.message),
  });
  try {
    const first = waitForBuild();
    queue.schedule();
    queue.schedule();
    await first;
    queue.schedule();
    queue.schedule();
    assert.equal(builds, 1);
    const second = waitForBuild();
    finish();
    await second;
    assert.equal(builds, 2);
    assert.deepEqual(errors, ['invalid JSDoc']);
    finish();
  } finally {
    queue.close();
  }
});
