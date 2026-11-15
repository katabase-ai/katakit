import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkLinks } from './check-links.mjs';

test('published pages have working cross-page links and heading fragments', () => {
  assert.deepEqual(checkLinks(), []);
});
