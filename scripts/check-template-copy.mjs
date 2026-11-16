import { spawnSync } from 'node:child_process';
import { cpSync, lstatSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTemplateManifests } from './check-template-manifests.mjs';

const templates = fileURLToPath(new URL('../templates/', import.meta.url));
const name = process.argv[2] ?? 'chrome-extension';
if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Invalid template directory: ${name}`);

const problems = checkTemplateManifests();
if (problems.length) throw new Error(problems.join('\n'));

const source = join(templates, name);
const temporary = mkdtempSync(join(tmpdir(), 'katakit-template-copy-'));
const target = join(temporary, name);

const run = args => {
  const result = spawnSync('pnpm', args, { cwd: target, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pnpm ${args.join(' ')} failed (${result.status})`);
};

try {
  cpSync(source, target, {
    recursive: true,
    filter: path => {
      const parts = relative(source, path).split(sep);
      if (parts.some(part => ['node_modules', 'dist', '.git'].includes(part))) return false;
      if (lstatSync(path).isSymbolicLink()) throw new Error(`Template contains a symlink: ${path}`);
      return true;
    },
  });
  console.log(`Checking standalone copy of templates/${name} in ${target}`);
  run(['install', '--no-frozen-lockfile']);
  run(['build']);
  console.log(`Standalone copy of templates/${name} builds successfully.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
