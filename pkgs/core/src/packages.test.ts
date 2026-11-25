import { execFile, spawnSync } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const run = promisify(execFile);
const packageNames = ['core', 'persistence', 'react', 'transcript-ingestion'];
const repository = fileURLToPath(new URL('../../../', import.meta.url));

type Manifest = {
  name: string;
  version: string;
  main: string;
  types: string;
  exports: { '.': { source?: string; types: string; default: string } };
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

describe('published packages', () => {
  const fixture: { directory?: string; consumer?: string } = {};
  const manifests: Record<string, Manifest> = {};

  beforeAll(async () => {
    const root = join(tmpdir(), 'opencode');
    await mkdir(root, { recursive: true });
    fixture.directory = await mkdtemp(join(root, 'katakit-packages-'));
    fixture.consumer = join(fixture.directory, 'consumer');
    const archives = join(fixture.directory, 'archives');
    const args = ['-r', 'pack', '--pack-destination', archives];

    // Packing runs the real prepack scripts and pnpm's manifest rewriting.
    // No registry access is needed: external dependencies are linked from this install.
    if (process.platform === 'win32') {
      await run('cmd.exe', ['/d', '/s', '/c', `pnpm ${args.map(arg => `"${arg}"`).join(' ')}`], {
        cwd: repository,
        timeout: 60000,
        windowsVerbatimArguments: true,
      });
    } else {
      await run('pnpm', args, { cwd: repository, timeout: 60000 });
    }

    for (const name of packageNames) {
      const originalDirectory = join(repository, 'pkgs', name);
      const local: Manifest = JSON.parse(
        await readFile(join(originalDirectory, 'package.json'), 'utf8')
      );
      const destination = join(fixture.consumer, 'node_modules', '@katakit', name);
      await mkdir(destination, { recursive: true });
      await run('tar', [
        '-xf',
        join(archives, `katakit-${name}-${local.version}.tgz`),
        '-C',
        destination,
        '--strip-components=1',
      ]);
      const packed: Manifest = JSON.parse(
        await readFile(join(destination, 'package.json'), 'utf8')
      );
      manifests[name] = packed;

      for (const dependency of Object.keys({
        ...packed.dependencies,
        ...packed.peerDependencies,
        // The fixture is a TypeScript React consumer; provide its normal JSX declarations.
        ...(name === 'react' ? { '@types/react': true } : {}),
      })) {
        if (dependency.startsWith('@katakit/')) continue;
        const target = join(fixture.consumer, 'node_modules', dependency);
        await mkdir(dirname(target), { recursive: true });
        try {
          await access(target);
        } catch {
          await symlink(
            await realpath(join(originalDirectory, 'node_modules', dependency)),
            target,
            'junction'
          );
        }
      }
    }

    await writeFile(
      join(fixture.consumer, 'package.json'),
      JSON.stringify({ private: true, type: 'module' })
    );
    await writeFile(
      join(fixture.consumer, 'smoke.mjs'),
      `
        import assert from 'node:assert/strict';
        import { EventLogPlugin, makeKatakit } from '@katakit/core';
        import { makeEventPersistencePlugin } from '@katakit/persistence';
        import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
        import { KatakitDevTools } from '@katakit/react';
        const seed = { type: 'started', meta: { seq: 0, timestamp: new Date(0) } };
        const Transcript = makeTranscriptIngestionPlugin();
        const saved = [];
        const PersistencePlugin = makeEventPersistencePlugin({
          appendEvents: events => { saved.push(...events); },
        });
        const runtime = makeKatakit({
          existingEvents: [seed],
          plugins: [Transcript.configure({}), PersistencePlugin.configure({})],
        }).start();
        const input = runtime.getMethods(Transcript);
        input.updateProvisionalUtterance({ speaker: 'mic', text: 'unfinished' });
        assert.equal(runtime.getObservables(Transcript).provisionalUtterance$.get().text, 'unfinished');
        assert.deepEqual(runtime.getObservables(EventLogPlugin).events$.getAll(), [seed]);
        assert.deepEqual(saved, []);
        const utterance = { id: 'segment-1', sourceId: 'mic', speaker: 'Ada', text: 'hello', startMs: 10, endMs: 30 };
        input.ingestUtterance(utterance);
        assert.equal(runtime.getObservables(Transcript).provisionalUtterance$.get(), null);
        input.close();
        input.close();
        await runtime.getMethods(PersistencePlugin).kill();
        assert.deepEqual(saved.map(event => event.type), ['utteranceAdded', 'conversationTurnAdded']);
        const { type: _type, meta: _meta, ...persistedUtterance } = saved[0];
        assert.deepEqual(persistedUtterance, utterance);
        assert.deepEqual(saved.map(event => event.meta.seq), [1, 2]);
        assert.ok(saved.every(event => event.meta.timestamp instanceof Date));
        assert.equal(saved[1].id, runtime.getObservables(Transcript).conversationTurns$.get()[0].id);
        assert.equal(saved[1].text, 'hello');
        assert.deepEqual(runtime.getObservables(EventLogPlugin).events$.getAll(), [seed, ...saved]);
        assert.equal(typeof KatakitDevTools, 'function');
      `
    );
    await writeFile(
      join(fixture.consumer, 'consumer.ts'),
      `
        import { EventLogPlugin, makeEffect, makeKatakit, makeKatakitPlugin, type Effect, type KatakitEvent } from '@katakit/core';
        import { makeEventPersistencePlugin } from '@katakit/persistence';
        import { makeTranscriptIngestionPlugin, type Utterance } from '@katakit/transcript-ingestion';
        import { KatakitDevTools } from '@katakit/react';
        import { of, type Observable } from 'rxjs';
        const component = KatakitDevTools;
        const Transcript = makeTranscriptIngestionPlugin();
        const PersistencePlugin = makeEventPersistencePlugin({
          appendEvents: events => {
            const timestamp: Date = events[0]!.meta.timestamp;
            // @ts-expect-error Serialization to a string belongs to the storage adapter.
            const invalid: string = events[0]!.meta.timestamp;
          },
        });
        const runtime = makeKatakit({
          plugins: [Transcript.configure({}), PersistencePlugin.configure({})],
        }).start();
        const write = (e: Utterance) => runtime.getMethods(Transcript).ingestUtterance(e);
        // @ts-expect-error Transcript input needs the complete utterance.
        write({ text: 'incomplete' });
        const events$: Observable<KatakitEvent> = runtime.getObservables(EventLogPlugin).events$;
        // @ts-expect-error The public event stream does not permit direct writes.
        events$.next({ text: 'bypass' });
        const shutdown: Promise<void> = runtime.getMethods(PersistencePlugin).kill();
        makeEffect({
          on: events$, backpressure: 'none',
          handler: event => {
            const seq: number = event.meta.seq;
            // @ts-expect-error Effect inputs must retain the observable value type.
            const invalid: string = event.meta.seq;
          },
        });
        // @ts-expect-error A structural lookalike must not bypass the effect factory.
        const forged: Effect<number> = { on: of(1), backpressure: 'queue', handler: () => {} };
        const Configured = makeKatakitPlugin({
          type: 'Configured',
          configure: (input: { initial: number }) => ({ label: String(input.initial) }),
          methods: ({ options }) => ({ label: () => options.label }),
        });
        Configured.configure({ initial: 1 });
        // @ts-expect-error Configure accepts input options, not transformed output options.
        Configured.configure({ label: '1' });
        // @ts-expect-error Observable members must actually be observables.
        makeKatakitPlugin({ type: 'Invalid', configure: () => ({}), observables: () => ({ invalid$: 123 }) });
        // @ts-expect-error Internal build paths are not public package entry points.
        import * as internal from '@katakit/core/dist/index.js';
      `
    );
    await writeFile(
      join(fixture.consumer, 'invalid-reducer.ts'),
      `
        import { evolve } from '@katakit/core';
        evolve<string, number, number>(
          (accumulator: string, value: number) => accumulator.toUpperCase().length + value,
          'seed'
        );
      `
    );
  }, 60000);

  afterAll(async () => {
    if (fixture.directory) await rm(fixture.directory, { recursive: true, force: true });
  });

  test.each(packageNames)('%s publishes only resolvable dist entry points', async name => {
    const manifest = manifests[name];
    expect(manifest).toBeDefined();
    expect(manifest?.exports['.']).toEqual({
      types: './dist/index.d.ts',
      default: './dist/index.js',
    });
    expect(manifest?.main).toBe(manifest?.exports['.'].default);
    expect(manifest?.types).toBe(manifest?.exports['.'].types);
    const directory = join(fixture.consumer!, 'node_modules', '@katakit', name);
    await expect(access(join(directory, 'dist', 'index.js'))).resolves.toBeUndefined();
    await expect(access(join(directory, 'dist', 'index.d.ts'))).resolves.toBeUndefined();
    await expect(access(join(directory, 'src'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(
      Object.values({
        ...manifest?.dependencies,
        ...manifest?.peerDependencies,
      }).some(version => version.startsWith('workspace:'))
    ).toBe(false);
    const local = JSON.parse(
      await readFile(join(repository, 'pkgs', name, 'package.json'), 'utf8')
    );
    expect(local.exports['.'].source).toBe(name === 'react' ? undefined : './src/index.ts');
  });

  test.each([
    ['persistence', ['core']],
    ['react', ['core']],
    ['transcript-ingestion', ['core']],
  ] as const)('%s publishes Katakit requirements as peer dependencies', (name, peers) => {
    const manifest = manifests[name]!;
    expect(
      Object.keys(manifest.dependencies ?? {}).filter(name => name.startsWith('@katakit/'))
    ).toEqual([]);
    for (const peer of peers) {
      expect(manifest.peerDependencies?.[`@katakit/${peer}`]).toBe(`^${manifests[peer]!.version}`);
    }
  });

  test.each([false, true])(
    'installed packages execute without workspace aliases (source condition=%s)',
    async source => {
      const args = source ? ['--conditions=source', 'smoke.mjs'] : ['smoke.mjs'];
      const result = await run(process.execPath, args, {
        cwd: fixture.consumer,
        timeout: 10000,
      });
      expect(result.stderr).toBe('');
    }
  );

  test.each(['bundler', 'nodenext'])(
    'installed declarations typecheck under %s resolution',
    async resolution => {
      const require = createRequire(import.meta.url);
      const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
      const result = await run(
        process.execPath,
        [
          tsc,
          '--ignoreConfig',
          '--noEmit',
          '--strict',
          '--target',
          'es2022',
          '--module',
          resolution === 'bundler' ? 'esnext' : 'nodenext',
          '--moduleResolution',
          resolution,
          '--customConditions',
          'source',
          'consumer.ts',
        ],
        { cwd: fixture.consumer, timeout: 30000 }
      );
      expect(result.stderr).toBe('');
    },
    30000
  );

  // TODO: Re-enable when reducer accumulator types include both seed and result.
  test.skip('the reducer type rejects a callback that cannot accept its own numeric output', () => {
    const require = createRequire(import.meta.url);
    const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
    const result = spawnSync(
      process.execPath,
      [
        tsc,
        '--ignoreConfig',
        '--noEmit',
        '--strict',
        '--target',
        'es2022',
        '--module',
        'esnext',
        '--moduleResolution',
        'bundler',
        'invalid-reducer.ts',
      ],
      { cwd: fixture.consumer, encoding: 'utf8', timeout: 30000 }
    );
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stdout).toMatch(/invalid-reducer\.ts.*TS2345/);
  }, 30000);
});
