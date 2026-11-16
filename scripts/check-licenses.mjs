import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const apacheLicense = readFileSync(join(root, 'LICENSE'), 'utf8');

// pnpm supplies the workspace paths, so new packages and workspace globs are
// checked without maintaining a second list here.
const packages = JSON.parse(
  execFileSync('pnpm', ['-r', 'list', '--depth', '-1', '--json'], {
    cwd: root,
    encoding: 'utf8',
  }),
);

const errors = [];
for (const workspacePackage of packages) {
  const directory = workspacePackage.path;
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  if (manifest.private === true) continue;

  const name = manifest.name ?? relative(root, directory);
  if (manifest.license !== 'Apache-2.0') {
    errors.push(`${name}: expected "license": "Apache-2.0" in package.json`);
  }

  const licensePath = join(directory, 'LICENSE');
  try {
    // npm and pnpm omit symlinks from package tarballs, even when the target exists.
    if (lstatSync(licensePath).isSymbolicLink()) {
      errors.push(`${name}: LICENSE must be a real file (package tarballs omit symlinks)`);
    } else if (!statSync(licensePath).isFile() || readFileSync(licensePath, 'utf8') !== apacheLicense) {
      errors.push(`${name}: LICENSE must contain the repository's Apache-2.0 license text`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    errors.push(`${name}: missing package-local LICENSE`);
  }
}

if (errors.length > 0) {
  console.error(`Workspace license check failed:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Workspace package licenses OK');
}
