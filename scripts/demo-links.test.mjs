import assert from 'node:assert/strict';
import { mkdtempSync, lstatSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkDemoLinks, demoNames, exportDemo, root } from './demo-links.mjs';

const assertNoLinks = directory => {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const status = lstatSync(path);
    assert.equal(status.isSymbolicLink(), false, `${path} should be a real file or directory`);
    if (status.isDirectory()) assertNoLinks(path);
  }
};

test('workspace links resolve and exported demos are independent copies', () => {
  checkDemoLinks();
  const temp = mkdtempSync(join(tmpdir(), 'katakit-demo-export-'));
  try {
    for (const name of demoNames) {
      const destination = join(temp, name);
      exportDemo(name, destination);
      assertNoLinks(destination);
      assert.deepEqual(
        readFileSync(join(destination, 'src/audio-level-meter.css')),
        readFileSync(join(root, 'demos/bingo-react/src/audio-level-meter.css')),
      );
      assert.equal(lstatSync(join(destination, 'LICENSE')).isFile(), true);
    }
    assert.deepEqual(
      readFileSync(join(temp, 'bingo-extension/src/bingo/plugin.ts')),
      readFileSync(join(root, 'demos/bingo-react/src/bingo/plugin.ts')),
    );
    assert.deepEqual(
      readFileSync(join(temp, 'transcription-react/src/base.css')),
      readFileSync(join(root, 'demos/bingo-react/src/base.css')),
    );
    assert.throws(() => exportDemo('bingo-extension', join(temp, 'bingo-extension')), /already exists/);
    assert.throws(() => exportDemo('unknown', join(temp, 'unknown')), /Unknown demo/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
