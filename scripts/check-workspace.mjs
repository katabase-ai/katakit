import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Core and React bindings have their own reference pages; other published pkgs
// are plugins. Add a package here when it introduces a different public role.
const nonPluginPackages = new Set(['@katakit/core', '@katakit/react']);
const dependencyFields = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

const isFile = path => existsSync(path) && statSync(path).isFile();
const isNonemptyFile = path => isFile(path) && readFileSync(path, 'utf8').trim().length > 0;

export const checkWorkspace = (workspaceRoot, packagePaths) => {
  const errors = [];
  const warnings = [];
  const apacheLicense = readFileSync(join(workspaceRoot, 'LICENSE'), 'utf8');
  const packages = packagePaths.map(({ path }) => ({
    directory: path,
    manifest: JSON.parse(readFileSync(join(path, 'package.json'), 'utf8')),
  }));
  const names = new Set();

  for (const { directory, manifest } of packages) {
    const location = relative(workspaceRoot, directory).split(sep).join('/');
    const name = manifest.name ?? location;
    if (names.has(name)) errors.push(`${location}: duplicate workspace package name ${name}`);
    names.add(name);
  }

  for (const { directory, manifest } of packages) {
    const location = relative(workspaceRoot, directory).split(sep).join('/');
    const name = manifest.name ?? location;
    const label = `${location} (${name})`;
    const inPackages = location.startsWith('pkgs/');
    const inTemplates = location.startsWith('templates/');

    for (const field of dependencyFields) {
      for (const [dependency, version] of Object.entries(manifest[field] ?? {})) {
        if (version.startsWith('workspace:') && !names.has(dependency)) {
          errors.push(`${label}: ${field}.${dependency} refers to a missing workspace package`);
        } else if (
          dependency.startsWith('@katakit/') &&
          names.has(dependency) &&
          !version.startsWith('workspace:')
        ) {
          warnings.push(`${label}: use workspace: for ${field}.${dependency}`);
        }
      }
    }

    if (inPackages || inTemplates) {
      if (!isNonemptyFile(join(directory, 'README.md'))) {
        warnings.push(`${label}: missing package-local README.md`);
      }
      if (!isNonemptyFile(join(directory, 'AGENTS.md'))) {
        warnings.push(`${label}: missing package-local AGENTS.md`);
      }
    }

    if (
      inTemplates &&
      !isNonemptyFile(
        join(workspaceRoot, 'docs/pages/reference/templates', `${basename(directory)}.md`)
      )
    ) {
      warnings.push(`${label}: missing template reference page in docs/pages/reference/templates/`);
    }

    if (manifest.private === true) continue;

    if (manifest.license !== 'Apache-2.0') {
      errors.push(`${label}: expected "license": "Apache-2.0" in package.json`);
    }
    const licensePath = join(directory, 'LICENSE');
    if (!isFile(licensePath)) {
      errors.push(`${label}: missing package-local LICENSE`);
    } else if (readFileSync(licensePath, 'utf8') !== apacheLicense) {
      errors.push(`${label}: LICENSE must contain the repository's Apache-2.0 license text`);
    }

    if (inPackages) {
      if (manifest.repository?.directory !== location) {
        warnings.push(`${label}: repository.directory should be ${location}`);
      }
      if (!manifest.publishConfig?.exports) {
        warnings.push(`${label}: missing publishConfig.exports`);
      }
      if (!isFile(join(directory, 'src/index.ts'))) {
        warnings.push(`${label}: missing src/index.ts public entry point`);
      }
      if (
        manifest.main !== './dist/index.js' ||
        manifest.types !== './dist/index.d.ts' ||
        manifest.exports?.['.']?.source !== './src/index.ts' ||
        manifest.exports?.['.']?.types !== manifest.types ||
        manifest.exports?.['.']?.default !== manifest.main
      ) {
        warnings.push(
          `${label}: main, types and exports should agree on src/index.ts and dist/index`
        );
      }
      if (
        !nonPluginPackages.has(name) &&
        !isNonemptyFile(
          join(workspaceRoot, 'docs/pages/reference/plugins', `${basename(directory)}.md`)
        )
      ) {
        warnings.push(`${label}: missing plugin reference page in docs/pages/reference/plugins/`);
      }
    }
  }

  return { errors, warnings };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // pnpm supplies workspace paths so newly added packages are checked automatically.
  const packages = JSON.parse(
    execFileSync('pnpm', ['-r', 'list', '--depth', '-1', '--json'], { cwd: root, encoding: 'utf8' })
  );
  const { errors, warnings } = checkWorkspace(root, packages);
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);
  console.error(`Workspace structure: ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (errors.length) process.exitCode = 1;
}
