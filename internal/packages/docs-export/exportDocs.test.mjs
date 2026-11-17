import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guideSlug, rewriteLinks } from './exportDocs.mjs';

test('landing-page normalization preserves nested guide links and anchors', () => {
  assert.equal(guideSlug('reference/plugins/README.md'), 'reference/plugins');
  const markdown = rewriteLinks({
    markdown: '[Guide](../../concepts/README.md#lifecycle)\n',
    file: 'reference/plugins/transcription.md',
    destinations: {
      'reference/plugins/transcription.md': 'reference/plugins/transcription.md',
      'concepts/README.md': 'concepts.md',
    },
  });
  assert.match(markdown, /\(\.\.\/\.\.\/concepts\.md#lifecycle\)/);
});

test('missing local content fails instead of becoming an external or default-page link', () => {
  assert.throws(
    () =>
      rewriteLinks({
        markdown: '[Missing](lost.md)',
        file: 'guide.md',
        destinations: { 'guide.md': 'guide.md' },
      }),
    /unresolved documentation link/
  );
});
