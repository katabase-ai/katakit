import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const registry = 'https://registry.npmjs.org';
const fields = ['dependencies', 'optionalDependencies', 'peerDependencies'];
// Temporary release policy. Set true to lift it, then update the policy test and skill note.
const allowMajorBumps = false;

const command = (program, args, cwd = root) => {
  // npm/pnpm are .cmd shims on Windows; use their JS entry points where available.
  const cli = program === 'pnpm' ? process.env.npm_execpath : undefined;
  const result = spawnSync(cli ? process.execPath : program, cli ? [cli, ...args] : args, {
    cwd,
    encoding: 'utf8',
    shell: !cli && process.platform === 'win32' && ['npm', 'pnpm'].includes(program),
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
};
const run = (program, args, cwd) => {
  const result = command(program, args, cwd);
  if (result.status !== 0)
    throw new Error(`${program} ${args.join(' ')} failed:\n${result.stderr}\n${result.stdout}`);
  return result.stdout.trim();
};

const stableVersion = version => {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? ''))
    throw new Error(`Expected a stable x.y.z version, received ${version}`);
  return version.split('.').map(BigInt);
};
const increases = (before, after) => {
  const oldParts = stableVersion(before);
  const newParts = stableVersion(after);
  for (let i = 0; i < 3; i++) {
    if (oldParts[i] !== newParts[i]) return newParts[i] > oldParts[i];
  }
  return false;
};

export const releaseNotes = (changelog, version) => {
  const sections = changelog.replaceAll('\r\n', '\n').split(/^## /m);
  const matches = sections.slice(1).filter(section => section.split('\n')[0].trim() === version);
  const notes = matches[0]?.split('\n').slice(1).join('\n').trim();
  if (matches.length !== 1 || !notes)
    throw new Error(`Expected one nonempty changelog section headed "## ${version}"`);
  return notes;
};

// Inputs are snapshots from Git, not mutable working-tree manifests.
export const planRelease = (before, after, changelog) => {
  const plan = [];
  for (const [directory, manifest] of Object.entries(after)) {
    if (manifest.private) continue;
    if (before[directory] && before[directory].name !== manifest.name)
      throw new Error(`Package rename at ${directory}: release a new package directory instead`);
    const previous = Object.values(before).find(candidate => candidate.name === manifest.name);
    if (previous && !previous.private && previous.version === manifest.version) continue;
    if (!/^@katakit\/[a-z0-9][a-z0-9-]*$/.test(manifest.name))
      throw new Error(`Invalid public package name at ${directory}`);
    const [major] = stableVersion(manifest.version);
    if (previous && !increases(previous.version, manifest.version))
      throw new Error(`${manifest.name}: version must increase from ${previous.version}`);
    if (!allowMajorBumps && major > stableVersion(previous?.version ?? '0.0.0')[0])
      throw new Error(`${manifest.name}: major version bumps are temporarily disabled`);
    if (manifest.version === '0.0.0')
      throw new Error(`${manifest.name}: choose an initial version`);
    plan.push({
      directory,
      name: manifest.name,
      version: manifest.version,
      previous: previous?.version ?? null,
      tag: `${manifest.name}@${manifest.version}`,
      notes: releaseNotes(changelog(directory), manifest.version),
    });
  }
  return plan;
};

const snapshot = ref =>
  Object.fromEntries(
    run('git', ['ls-tree', '-r', '--name-only', ref, '--', 'pkgs'])
      .split('\n')
      .filter(path => /^pkgs\/[^/]+\/package.json$/.test(path))
      .map(path => [
        path.slice(0, -'/package.json'.length),
        JSON.parse(run('git', ['show', `${ref}:${path}`])),
      ])
  );

export const registryResult = result => {
  let value;
  try {
    value = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Invalid npm registry response: ${result.stderr}`, { cause: error });
  }
  if (result.status === 0 && !value.error) return value;
  if (value.error?.code === 'E404') return null;
  throw new Error(`npm registry lookup failed: ${result.stderr || JSON.stringify(value)}`);
};
const lookup = (name, version) =>
  registryResult(command('npm', ['view', `${name}@${version}`, '--json', '--registry', registry]));

export const validateArchive = (item, manifest, files) => {
  if (manifest.name !== item.name || manifest.version !== item.version || manifest.private)
    throw new Error(`Archive identity mismatch: ${item.tag}`);
  for (const required of ['package/LICENSE', 'package/README.md']) {
    if (!files.includes(required)) throw new Error(`${item.tag}: missing ${required}`);
  }
  const checkExports = value => {
    if (typeof value === 'string') {
      if (!value.startsWith('./') || !files.includes(`package/${value.slice(2)}`))
        throw new Error(`${item.tag}: missing exported file ${value}`);
    } else if (value && typeof value === 'object') {
      if (Object.hasOwn(value, 'source'))
        throw new Error(`${item.tag}: workspace source condition leaked into exports`);
      Object.values(value).forEach(checkExports);
    }
  };
  if (!manifest.exports) throw new Error(`${item.tag}: missing exports`);
  checkExports(manifest.exports);
  for (const field of fields) {
    for (const [name, range] of Object.entries(manifest[field] ?? {})) {
      if (/^(workspace:|file:|link:)/.test(range))
        throw new Error(`${item.tag}: unpublished ${field} entry ${name}: ${range}`);
    }
  }
};

const pack = (item, temporary) => {
  run('pnpm', ['pack', '--pack-destination', temporary], join(root, item.directory));
  const archive = join(
    temporary,
    `katakit-${item.name.slice('@katakit/'.length)}-${item.version}.tgz`
  );
  const manifest = JSON.parse(run('tar', ['-xOf', archive, 'package/package.json']));
  const files = run('tar', ['-tzf', archive]).split(/\r?\n/);
  validateArchive(item, manifest, files);
  // Check the exact bytes we will publish, before publishing any selected package.
  console.log(run('pnpm', ['exec', 'publint', archive, '--strict']));
  return {
    ...item,
    manifest,
    archive,
    integrity: `sha512-${createHash('sha512').update(readFileSync(archive)).digest('base64')}`,
  };
};

// pnpm rewrites workspace:^, workspace:~ and workspace:* to these exact forms.
// Other ranges must already be satisfiable from npm.
export const dependencyOrder = (items, find = lookup) => {
  const ordered = [];
  const visiting = new Set();
  const visit = item => {
    if (ordered.includes(item)) return;
    if (visiting.has(item)) throw new Error(`Cyclic release dependency: ${item.name}`);
    visiting.add(item);
    for (const field of fields) {
      for (const [name, range] of Object.entries(item.manifest[field] ?? {})) {
        if (!name.startsWith('@katakit/')) continue;
        const pending = items.find(
          candidate =>
            candidate.name === name &&
            [candidate.version, `^${candidate.version}`, `~${candidate.version}`].includes(range)
        );
        if (pending) visit(pending);
        else if (!find(name, range))
          throw new Error(
            `${item.tag}: ${name}@${range} must be published or included in this release`
          );
      }
    }
    visiting.delete(item);
    ordered.push(item);
  };
  items.forEach(visit);
  return ordered;
};

export const verifyPublished = (item, published) => {
  if (
    published.name !== item.name ||
    published.version !== item.version ||
    published.dist?.integrity !== item.integrity
  )
    throw new Error(
      `${item.tag} already exists on npm with different contents; refusing to continue`
    );
};

// All packages are preflighted before the first publish; tags come after all npm successes.
export const executeRelease = async (items, sha, io) => {
  const missing = [];
  for (const item of items) {
    await io.checkTag(item, sha);
    const published = await io.lookup(item.name, item.version);
    if (published) verifyPublished(item, published);
    else missing.push(item);
  }
  for (const item of missing) {
    await io.publish(item);
    verifyPublished(item, await io.waitForVersion(item));
  }
  await io.pushTags(items, sha);
  for (const item of items) await io.release(item);
};

const checkTag = (item, sha) => {
  const ref = `refs/tags/${item.tag}`;
  const result = command('git', ['show-ref', '--verify', '--quiet', ref]);
  if (result.status === 1) return;
  if (result.status !== 0) throw new Error(`Cannot inspect tag ${item.tag}`);
  if (run('git', ['rev-parse', `${ref}^{commit}`]) !== sha)
    throw new Error(`${item.tag} already points to another commit`);
};
const pushTags = (items, sha) => {
  for (const item of items) {
    if (command('git', ['show-ref', '--verify', '--quiet', `refs/tags/${item.tag}`]).status === 1)
      run('git', ['tag', item.tag, sha]);
  }
  run('git', ['push', '--atomic', 'origin', ...items.map(item => `refs/tags/${item.tag}`)]);
};
const githubRelease = (item, temporary) => {
  const result = command('gh', [
    'api',
    `repos/{owner}/{repo}/releases/tags/${encodeURIComponent(item.tag)}`,
  ]);
  if (result.status === 0) {
    const release = JSON.parse(result.stdout);
    if (release.draft || release.prerelease)
      throw new Error(`Expected a published stable GitHub release for ${item.tag}`);
    return;
  }
  if (!result.stderr.includes('(HTTP 404)'))
    throw new Error(`Cannot inspect GitHub release ${item.tag}: ${result.stderr}`);
  const notes = join(temporary, `${item.name.slice('@katakit/'.length)}.md`);
  writeFileSync(notes, item.notes);
  run('gh', [
    'release',
    'create',
    item.tag,
    '--verify-tag',
    '--title',
    item.tag,
    '--notes-file',
    notes,
    '--latest=false',
  ]);
};

const main = async () => {
  const [mode, baseRef, headRef] = process.argv.slice(2);
  if (!['plan', 'pack', 'publish'].includes(mode) || !baseRef || !headRef)
    throw new Error('Usage: pnpm release:<plan|pack|publish> <base-sha> <head-sha>');
  const sha = run('git', ['rev-parse', '--verify', `${headRef}^{commit}`]);
  const base = run('git', ['rev-parse', '--verify', `${baseRef}^{commit}`]);
  run('git', ['merge-base', '--is-ancestor', base, sha]);
  const plan = planRelease(snapshot(base), snapshot(sha), directory =>
    run('git', ['show', `${sha}:${directory}/CHANGELOG.md`])
  );
  console.log(JSON.stringify(plan, null, 2));
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `count=${plan.length}\n`);
  if (mode === 'plan' || !plan.length) return;
  if (run('git', ['rev-parse', 'HEAD']) !== sha) throw new Error('Check out the exact release SHA');
  run('git', ['diff', '--exit-code', sha, '--', 'pkgs']);
  if (mode === 'publish' && (!process.env.NODE_AUTH_TOKEN || !process.env.GH_TOKEN))
    throw new Error('Publishing requires NODE_AUTH_TOKEN and GH_TOKEN');
  const temporary = mkdtempSync(join(tmpdir(), 'katakit-release-'));
  try {
    const items = dependencyOrder(plan.map(item => pack(item, temporary)));
    if (mode === 'pack') {
      console.log(`Validated ${items.length} npm archives and their Katakit dependencies.`);
      return;
    }
    await executeRelease(items, sha, {
      lookup,
      checkTag,
      publish: item => {
        console.log(`Publishing ${item.tag}`);
        run('pnpm', [
          'publish',
          item.archive,
          '--no-git-checks',
          '--ignore-scripts',
          '--access',
          'public',
          '--tag',
          'latest',
          '--registry',
          registry,
        ]);
      },
      waitForVersion: async item => {
        for (let attempt = 0; attempt < 6; attempt++) {
          const published = lookup(item.name, item.version);
          if (published) return published;
          await setTimeout(5000);
        }
        throw new Error(`${item.tag} is not visible on npm yet; rerun this workflow`);
      },
      pushTags,
      release: item => githubRelease(item, temporary),
    });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
