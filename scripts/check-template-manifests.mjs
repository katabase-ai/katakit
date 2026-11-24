import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const templates = fileURLToPath(new URL('../examples/starters/', import.meta.url));
const dependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];
const localOrExternalSource =
  /^(?:workspace:|file:|link:|portal:|git(?:\+|:)|github:|https?:|ssh:)/i;

export const checkTemplateManifests = (directory = templates, names) => {
  const problems = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (names && !names.includes(entry.name)) continue;
    const manifestPath = join(directory, entry.name, 'package.json');
    for (const required of ['README.md', 'LICENSE']) {
      try {
        if (lstatSync(join(directory, entry.name, required)).isFile()) continue;
      } catch {
        // A copied directory must carry its own instructions and license.
      }
      problems.push(`${entry.name}: missing ${required}`);
    }
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
      problems.push(`${entry.name}: missing or invalid package.json`);
      continue;
    }
    if (!manifest.scripts?.build) problems.push(`${entry.name}: missing build script`);
    const settings = join(directory, entry.name, 'pnpm-workspace.yaml');
    if (
      Object.keys(manifest.pnpm?.overrides ?? {}).length ||
      Object.keys(manifest.overrides ?? {}).length ||
      (existsSync(settings) && /^overrides:/m.test(readFileSync(settings, 'utf8')))
    ) {
      problems.push(`${entry.name}: dependency overrides belong only in disposable test copies`);
    }
    for (const field of dependencyFields) {
      for (const [name, version] of Object.entries(manifest[field] ?? {})) {
        if (typeof version !== 'string' || !version.trim() || localOrExternalSource.test(version)) {
          problems.push(`${entry.name}: ${field}.${name} must use an installable registry version`);
        }
      }
    }
  }
  return problems;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkTemplateManifests();
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Template manifests declare standalone build dependencies.');
  }
}
