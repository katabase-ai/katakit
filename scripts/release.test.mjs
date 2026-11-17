import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  dependencyOrder,
  executeRelease,
  planRelease,
  registryResult,
  releaseNotes,
  validateArchive,
  waitForVersion,
} from './release.mjs';
import { prepareRelease } from './prepare-release.mjs';
import { withExamplePackages } from './example-test-packages.mjs';

const manifest = (name, version, extra = {}) => ({ name: `@katakit/${name}`, version, ...extra });
const notes = () => '# Changes\n\n## 0.1.0\n\nFirst release.\n\n## 0.0.0\n\nEarlier notes.';

test('CLI plans the exact Git snapshots even when HEAD and working files have moved on', t => {
  const directory = mkdtempSync(join(tmpdir(), 'katakit-release-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  mkdirSync(join(directory, 'scripts'));
  mkdirSync(join(directory, 'pkgs/core'), { recursive: true });
  copyFileSync(new URL('./release.mjs', import.meta.url), join(directory, 'scripts/release.mjs'));
  const writeVersion = version => {
    writeFileSync(
      join(directory, 'pkgs/core/package.json'),
      JSON.stringify(manifest('core', version))
    );
    writeFileSync(
      join(directory, 'pkgs/core/CHANGELOG.md'),
      `## ${version}\n\nNotes for ${version}.\n`
    );
    git('add', '.');
    git(
      '-c',
      'user.name=Release Test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-qm',
      version
    );
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q');
  git('config', 'core.autocrlf', 'false');
  git('config', 'core.hooksPath', join(directory, 'no-hooks'));
  const base = writeVersion('0.0.0');
  const release = writeVersion('0.1.0');
  writeVersion('0.2.0');
  writeFileSync(join(directory, 'pkgs/core/package.json'), 'uncommitted invalid JSON');
  const output = execFileSync(
    process.execPath,
    [join(directory, 'scripts/release.mjs'), 'plan', base, release],
    { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: '' } }
  );
  const plan = JSON.parse(output);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].version, '0.1.0');
  assert.equal(plan[0].notes, 'Notes for 0.1.0.');
});

test('recovery uses current tooling but preserves the original release package and build snapshot', t => {
  const directory = mkdtempSync(join(tmpdir(), 'katakit-release-recovery-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'core.autocrlf', 'false');
  git('config', 'core.hooksPath', join(directory, 'no-hooks'));
  mkdirSync(join(directory, 'scripts'));
  mkdirSync(join(directory, 'pkgs/core'), { recursive: true });
  const commit = (version, runner) => {
    writeFileSync(
      join(directory, 'pkgs/core/package.json'),
      JSON.stringify(manifest('core', version))
    );
    writeFileSync(join(directory, 'pnpm-lock.yaml'), `snapshot: ${version}\n`);
    writeFileSync(join(directory, 'scripts/build.mjs'), `// build ${version}\n`);
    writeFileSync(join(directory, 'scripts/release.mjs'), runner);
    git('add', '.');
    git(
      '-c',
      'user.name=Release Test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-qm',
      version
    );
    return git('rev-parse', 'HEAD');
  };
  const base = commit('0.0.0', '// old runner\n');
  const release = commit('0.1.0', '// old runner\n');
  const tooling = commit('0.2.0', '// corrected runner\n');

  assert.throws(() => prepareRelease('main', release, directory), /full base and release/);
  assert.throws(() => prepareRelease(tooling, release, directory));
  assert.equal(git('rev-parse', 'HEAD'), tooling);
  writeFileSync(join(directory, 'scripts/build.mjs'), '// user work\n');
  assert.throws(() => prepareRelease(base, release, directory));
  assert.equal(readFileSync(join(directory, 'scripts/build.mjs'), 'utf8'), '// user work\n');
  git('restore', 'scripts/build.mjs');

  assert.deepEqual(prepareRelease(base, release, directory), {
    baseSha: base,
    releaseSha: release,
    toolingSha: tooling,
  });
  assert.equal(git('rev-parse', 'HEAD'), release);
  assert.equal(
    readFileSync(join(directory, 'scripts/release.mjs'), 'utf8'),
    '// corrected runner\n'
  );
  assert.equal(git('diff', '--name-only'), 'scripts/release.mjs');
  assert.equal(readFileSync(join(directory, 'pnpm-lock.yaml'), 'utf8'), 'snapshot: 0.1.0\n');
  assert.equal(readFileSync(join(directory, 'scripts/build.mjs'), 'utf8'), '// build 0.1.0\n');
  assert.equal(
    JSON.parse(readFileSync(join(directory, 'pkgs/core/package.json'))).version,
    '0.1.0'
  );

  // Recovery cannot select a release newer than its trusted tooling checkout.
  assert.throws(() => prepareRelease(base, tooling, directory));
  assert.equal(git('rev-parse', 'HEAD'), release);
});

test('selects only bumped public libraries, including a new package', () => {
  const before = {
    'pkgs/core': manifest('core', '0.0.0'),
    'pkgs/event-log': manifest('event-log', '0.0.0'),
    'pkgs/private': manifest('private', '0.0.0', { private: true }),
  };
  const after = {
    ...before,
    'pkgs/core': manifest('core', '0.1.0'),
    'pkgs/new': manifest('new', '0.1.0'),
    'pkgs/private': manifest('private', '0.1.0', { private: true }),
  };
  const result = planRelease(before, after, notes);
  assert.deepEqual(
    result.map(({ name, tag, previous }) => ({ name, tag, previous })),
    [
      { name: '@katakit/core', tag: '@katakit/core@0.1.0', previous: '0.0.0' },
      { name: '@katakit/new', tag: '@katakit/new@0.1.0', previous: null },
    ]
  );
  assert.equal(result[0].notes, 'First release.');
  assert.deepEqual(
    planRelease(after, after, () => assert.fail('No notes needed for a no-op')),
    []
  );
});

test('moving a package directory without a version bump does not select it for release', () => {
  assert.deepEqual(
    planRelease(
      { 'pkgs/old-directory': manifest('core', '0.1.0') },
      { 'pkgs/new-directory': manifest('core', '0.1.0') },
      () => assert.fail('A directory move is not a version bump')
    ),
    []
  );
});

test('compares numeric version components and rejects downgrades, invalid versions and renames', () => {
  const previous = version => ({ 'pkgs/core': manifest('core', version) });
  assert.equal(
    planRelease(previous('0.9.0'), previous('0.10.0'), () => '## 0.10.0\n\nChange.').length,
    1
  );
  assert.throws(() => planRelease(previous('0.2.0'), previous('0.1.0'), notes), /must increase/);
  for (const version of ['01.0.0', '0.1.0-beta.1', '1.0', '1.0.0+build'])
    assert.throws(() => planRelease(previous('0.0.0'), previous(version), notes), /stable/);
  assert.throws(() => planRelease({}, previous('0.0.0'), notes), /initial version/);
  assert.throws(
    () => planRelease(previous('0.0.0'), { 'pkgs/core': manifest('renamed', '0.1.0') }, notes),
    /rename/
  );
});

test('temporary major-bump policy rejects major increases and initial 1.x releases', () => {
  for (const [before, after] of [
    ['0.9.0', '1.0.0'],
    ['1.2.3', '2.0.0'],
    [null, '1.0.0'],
  ]) {
    assert.throws(
      () =>
        planRelease(
          before ? { 'pkgs/core': manifest('core', before) } : {},
          { 'pkgs/core': manifest('core', after) },
          () => assert.fail('Major bump must fail before reading release notes')
        ),
      /major version bumps are temporarily disabled/
    );
  }
});

test('minor and patch releases remain allowed within the current major', () => {
  for (const [before, after] of [
    ['0.1.0', '0.2.0'],
    ['0.1.0', '0.1.1'],
    ['1.2.3', '1.3.0'],
    ['1.2.3', '1.2.4'],
  ]) {
    const plan = planRelease(
      { 'pkgs/core': manifest('core', before) },
      { 'pkgs/core': manifest('core', after) },
      () => `## ${after}\n\nChange.`
    );
    assert.equal(plan[0].version, after);
  }
});

test('extracts exactly the selected changelog section and requires nonempty unique notes', () => {
  assert.equal(releaseNotes(notes().replaceAll('\n', '\r\n'), '0.1.0'), 'First release.');
  for (const text of [
    '# Empty',
    '## 0.1.0',
    '## 0.1.0\n\n## 0.0.0\nOld',
    '## 0.1.0\nFirst\n## 0.1.0\nSecond',
  ])
    assert.throws(() => releaseNotes(text, '0.1.0'), /nonempty changelog/);
});

test('only genuine registry E404 is absence; authentication, network and malformed responses fail', () => {
  const response = (status, value) => ({ status, stdout: JSON.stringify(value), stderr: 'error' });
  assert.equal(registryResult(response(1, { error: { code: 'E404' } })), null);
  assert.deepEqual(registryResult(response(0, { version: '0.1.0' })), { version: '0.1.0' });
  for (const code of ['E401', 'E403', 'E500', 'ENOTFOUND', 'ETIMEDOUT'])
    assert.throws(() => registryResult(response(1, { error: { code } })), /lookup failed/);
  assert.throws(
    () => registryResult({ status: 1, stdout: 'not json', stderr: 'network' }),
    /Invalid npm registry/
  );
});

const item = (name, peers = {}) => ({
  name: `@katakit/${name}`,
  version: '0.1.0',
  tag: `@katakit/${name}@0.1.0`,
  integrity: `sha512-${name}`,
  manifest: { peerDependencies: peers },
});

test('orders selected dependencies first and requires unselected dependencies to exist on npm', () => {
  const core = item('core');
  const log = item('event-log', { '@katakit/core': '^0.1.0' });
  const persistence = item('persistence', { '@katakit/event-log': '^0.1.0' });
  assert.deepEqual(
    dependencyOrder([persistence, log, core], () =>
      assert.fail('Selected version needs no lookup')
    ),
    [core, log, persistence]
  );
  assert.throws(() => dependencyOrder([log], () => null), /must be published/);
  const queries = [];
  assert.deepEqual(
    dependencyOrder([log], (name, range) => {
      queries.push([name, range]);
      return { version: '0.1.0' };
    }),
    [log]
  );
  assert.deepEqual(queries, [['@katakit/core', '^0.1.0']]);
  assert.throws(
    () =>
      dependencyOrder([
        item('core', { '@katakit/event-log': '^0.1.0' }),
        item('event-log', { '@katakit/core': '^0.1.0' }),
      ]),
    /Cyclic/
  );
});

test('archive validation rejects missing exports, source conditions and local dependency references', () => {
  const core = item('core');
  const packed = {
    name: core.name,
    version: core.version,
    exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
  };
  const files = [
    'package/LICENSE',
    'package/README.md',
    'package/dist/index.d.ts',
    'package/dist/index.js',
  ];
  validateArchive(core, packed, files);
  assert.throws(() => validateArchive(core, packed, files.slice(1)), /missing package\/LICENSE/);
  assert.throws(() => validateArchive(core, packed, files.slice(0, -1)), /missing exported file/);
  assert.throws(
    () => validateArchive(core, { ...packed, version: '0.2.0' }, files),
    /identity mismatch/
  );
  assert.throws(
    () => validateArchive(core, { ...packed, exports: { source: './src/index.ts' } }, files),
    /source condition/
  );
  assert.throws(
    () => validateArchive(core, { ...packed, peerDependencies: { dep: 'workspace:^' } }, files),
    /unpublished/
  );
});

const fixture = () => {
  const events = [];
  const published = new Map();
  const tags = new Map();
  const releases = new Set();
  const record = pkg => ({
    name: pkg.name,
    version: pkg.version,
    dist: { integrity: pkg.integrity },
  });
  const io = {
    checkTag: (pkg, sha) => {
      if (tags.has(pkg.tag) && tags.get(pkg.tag) !== sha) throw new Error('tag conflict');
    },
    lookup: name => published.get(name),
    publish: pkg => {
      events.push(`publish ${pkg.name}`);
      published.set(pkg.name, record(pkg));
    },
    waitForVersion: pkg => published.get(pkg.name),
    pushTags: (packages, sha) => {
      events.push('tags');
      packages.forEach(pkg => tags.set(pkg.tag, sha));
    },
    release: pkg => {
      if (!releases.has(pkg.tag)) events.push(`release ${pkg.name}`);
      releases.add(pkg.tag);
    },
  };
  return { events, published, tags, releases, io, record };
};

const visibilityClock = lookup => {
  let time = 0;
  const delays = [];
  const messages = [];
  return {
    delays,
    messages,
    io: {
      lookup,
      now: () => time,
      sleep: async ms => {
        delays.push(ms);
        time += ms;
      },
      log: message => messages.push(message),
    },
  };
};

test('waits beyond the old thirty-second limit and verifies matching published contents', async () => {
  const pkg = item('core');
  const published = fixture().record(pkg);
  let calls = 0;
  const { io, delays, messages } = visibilityClock((name, version) => {
    assert.equal(name, pkg.name);
    assert.equal(version, pkg.version);
    return ++calls === 25 ? published : null;
  });
  assert.equal(await waitForVersion(pkg, io), published);
  assert.equal(
    delays.reduce((sum, delay) => sum + delay, 0),
    6 * 60 * 1000
  );
  assert.match(messages[0], /Waiting for @katakit\/core@0.1.0/);
  assert.match(messages.at(-1), /Verified.*360s/);
});

test('visibility timeout is bounded and does not retry publishing', async () => {
  let calls = 0;
  const { io, delays } = visibilityClock(() => {
    calls++;
    return null;
  });
  await assert.rejects(
    waitForVersion(item('core'), io, { timeoutMs: 40000, intervalMs: 15000 }),
    /after 40s.*Publication may already have succeeded/
  );
  assert.equal(calls, 3);
  assert.deepEqual(delays, [15000, 15000, 10000]);
});

test('visibility checks fail immediately on lookup errors or conflicting contents', async () => {
  for (const lookup of [
    () => {
      throw new Error('authentication failed');
    },
    () => fixture().record({ ...item('core'), integrity: 'different' }),
  ]) {
    const { io, delays } = visibilityClock(lookup);
    await assert.rejects(
      waitForVersion(item('core'), io),
      /authentication failed|different contents/
    );
    assert.deepEqual(delays, []);
  }
});

test('resuming after a visibility timeout skips the package once its matching version is visible', async () => {
  const { io, events, tags, published } = fixture();
  const packages = [item('core'), item('event-log')];
  const wait = io.waitForVersion;
  io.waitForVersion = pkg =>
    waitForVersion(pkg, visibilityClock(() => null).io, { timeoutMs: 100, intervalMs: 50 });
  await assert.rejects(executeRelease(packages, 'original-merge', io), /not visible/);
  assert.equal(published.size, 1);
  assert.equal(tags.size, 0);
  io.waitForVersion = wait;
  await executeRelease(packages, 'original-merge', io);
  assert.equal(events.filter(event => event === 'publish @katakit/core').length, 1);
  assert.deepEqual([...tags.values()], ['original-merge', 'original-merge']);
});

test('publishes all packages before tagging the exact merge SHA and creating releases', async () => {
  const { events, tags, io } = fixture();
  const packages = [item('core'), item('event-log')];
  await executeRelease(packages, 'exact-merged-sha', io);
  assert.deepEqual(events, [
    'publish @katakit/core',
    'publish @katakit/event-log',
    'tags',
    'release @katakit/core',
    'release @katakit/event-log',
  ]);
  assert.deepEqual([...tags.values()], ['exact-merged-sha', 'exact-merged-sha']);
});

test('partial npm failure creates no tags; a rerun skips matching published versions', async () => {
  const { events, tags, published, io } = fixture();
  const packages = [item('core'), item('event-log')];
  const publish = io.publish;
  io.publish = pkg => {
    if (pkg.name === '@katakit/event-log') throw new Error('npm unavailable');
    publish(pkg);
  };
  await assert.rejects(executeRelease(packages, 'merge', io), /npm unavailable/);
  assert.equal(published.size, 1);
  assert.equal(tags.size, 0);
  io.publish = publish;
  await executeRelease(packages, 'merge', io);
  assert.equal(events.filter(event => event === 'publish @katakit/core').length, 1);
  assert.equal(tags.size, 2);
});

test('preflights every package and refuses conflicting npm contents or tag targets before publishing', async () => {
  const packages = [item('core'), item('event-log')];
  for (const conflict of ['npm', 'tag']) {
    const { events, published, tags, io, record } = fixture();
    if (conflict === 'npm')
      published.set(packages[1].name, record({ ...packages[1], integrity: 'different' }));
    else tags.set(packages[1].tag, 'other-sha');
    await assert.rejects(executeRelease(packages, 'merge', io), /different contents|tag conflict/);
    assert.deepEqual(events, []);
  }
});

test('publication visibility or integrity failure stops tags', async () => {
  const { tags, io } = fixture();
  io.waitForVersion = () => {
    throw new Error('not visible');
  };
  await assert.rejects(executeRelease([item('core')], 'merge', io), /not visible/);
  assert.equal(tags.size, 0);
});

test('a GitHub release failure can be retried without republishing or duplicating finished releases', async () => {
  const { events, releases, io } = fixture();
  const packages = [item('core'), item('event-log')];
  const release = io.release;
  io.release = pkg => {
    if (pkg.name === '@katakit/event-log') throw new Error('GitHub unavailable');
    release(pkg);
  };
  await assert.rejects(executeRelease(packages, 'merge', io), /GitHub unavailable/);
  assert.equal(releases.size, 1);
  io.release = release;
  await executeRelease(packages, 'merge', io);
  assert.equal(events.filter(event => event.startsWith('publish ')).length, 2);
  assert.equal(events.filter(event => event === 'release @katakit/core').length, 1);
  assert.equal(releases.size, 2);
});

test('registry example checks do not pack or override local packages', async () => {
  let checked = false;
  await withExamplePackages(
    prepare => {
      // A local-package check would try to write overrides into this nonexistent directory.
      prepare('nonexistent-registry-copy');
      checked = true;
    },
    { registry: true }
  );
  assert.equal(checked, true);
});
