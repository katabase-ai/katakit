import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test, expect } from 'vitest';

test('the shipped Moonshine runtime does not generate JavaScript under MV3 CSP', async () => {
  const runtime = await readFile(
    resolve('dist/transcription-assets/moonshine/moonshine.mjs'),
    'utf8'
  );
  expect(runtime).not.toMatch(/new Function\s*\(/);
  expect(runtime).toContain('var invokerFn=function(...callArgs)');
  expect(runtime).toContain('var invokerFunction=function(obj,func,destructorsRef,values)');
});
