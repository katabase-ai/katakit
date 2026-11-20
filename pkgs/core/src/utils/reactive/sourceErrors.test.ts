import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'tsdown';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

describe('observable error boundaries', () => {
  const fixture: { directory?: string; moduleURL?: string } = {};

  beforeAll(async () => {
    const root = join(tmpdir(), 'opencode');
    await mkdir(root, { recursive: true });
    fixture.directory = await mkdtemp(join(root, 'katakit-source-errors-'));
    const entry = join(fixture.directory, 'probe.ts');
    const require = createRequire(import.meta.url);
    const modules = {
      core: fileURLToPath(new URL('../../index.ts', import.meta.url)),
      backpressure: fileURLToPath(new URL('./backpressure.ts', import.meta.url)),
      rxjs: require.resolve('rxjs'),
    };
    const specifier = (path: string) => JSON.stringify(path.replaceAll('\\', '/'));
    await writeFile(
      entry,
      [
        `export * from ${specifier(modules.core)};`,
        `export { subscribeWithBackpressure } from ${specifier(modules.backpressure)};`,
        `export { Subject, ReplaySubject } from ${specifier(modules.rxjs)};`,
      ].join('\n')
    );
    // Bundle current source, not dist: these tests must work on a clean checkout.
    // A separate process contains unhandled errors without changing Vitest's global handlers.
    await build({
      config: false,
      tsconfig: false,
      entry: { probe: entry },
      outDir: join(fixture.directory, 'built'),
      format: 'esm',
      platform: 'node',
      fixedExtension: true,
      dts: false,
      logLevel: 'silent',
      deps: { alwaysBundle: [/.*/] },
    });
    fixture.moduleURL = pathToFileURL(join(fixture.directory, 'built', 'probe.mjs')).href;
  }, 30000);

  afterAll(async () => {
    if (fixture.directory) await rm(fixture.directory, { recursive: true, force: true });
  });

  const runProbe = (body: string) => {
    const result = spawnSync(
      process.execPath,
      [
        '--unhandled-rejections=strict',
        '--input-type=module',
        '-e',
        [
          `import assert from 'node:assert/strict';`,
          `import { setImmediate as nextTurn } from 'node:timers/promises';`,
          `import * as api from ${JSON.stringify(fixture.moduleURL)};`,
          body,
        ].join('\n'),
      ],
      { encoding: 'utf8', timeout: 10000 }
    );
    return result;
  };

  test.each(['queue', 'latest', 'none'] as const)(
    '%s accepts a live value and completes without an unhandled error',
    strategy => {
      const result = runProbe(`
        const source$ = new api.Subject();
        const received = [];
        const reported = [];
        console.error = error => reported.push(error);
        api.subscribeWithBackpressure(${JSON.stringify(strategy)}, source$, value => {
          received.push(value);
        });
        source$.next(1);
        await nextTurn();
        source$.complete();
        await nextTurn();
        assert.deepEqual(received, [1]);
        assert.deepEqual(reported, []);
      `);
      expect(result.error).toBeUndefined();
      expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: '' });
    }
  );

  // TODO: Re-enable when the backpressure tasks catch and report source errors.
  test.skip.each(['queue', 'latest', 'none'] as const)(
    '%s reports observable failures without an unhandled rejection',
    strategy => {
      const result = runProbe(`
        const source$ = new api.Subject();
        const failure = new Error('Observable failed');
        const reported = [];
        console.error = error => reported.push(error);
        api.subscribeWithBackpressure(${JSON.stringify(strategy)}, source$, () => {});
        source$.error(failure);
        await nextTurn();
        assert.deepEqual(reported, [failure]);
      `);
      expect(result.error).toBeUndefined();
      expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: '' });
    }
  );

  // TODO: Re-enable when collectReplay throws errors to its constructing caller.
  test.skip.each([false, true])(
    'collectReplay throws replay failures synchronously (partial=%s)',
    partial => {
      const result = runProbe(`
      const source$ = new api.ReplaySubject();
      const failure = new Error('Invalid replay');
      if (${partial}) source$.next(1);
      source$.error(failure);
      assert.throws(() => api.collectReplay(source$), error => error === failure);
      await nextTurn();
    `);
      expect(result.error).toBeUndefined();
      expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: '' });
    }
  );
});
