import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTemplateManifests } from './check-template-manifests.mjs';
import { runPnpm as run, withExamplePackages } from './example-test-packages.mjs';

const templates = fileURLToPath(new URL('../examples/starters/', import.meta.url));
const selected = process.argv[2];
if (selected && !/^[a-z0-9-]+$/.test(selected)) {
  throw new Error(`Invalid template directory: ${selected}`);
}

const problems = checkTemplateManifests();
if (problems.length) throw new Error(problems.join('\n'));

const names = selected
  ? [selected]
  : readdirSync(templates, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);

await withExamplePackages(async useLocalPackages => {
  for (const name of names) {
    const temporary = mkdtempSync(join(tmpdir(), 'katakit-template-copy-'));
    const target = join(temporary, name);
    try {
      execFileSync(
        process.execPath,
        [fileURLToPath(new URL('./copy-example.mjs', import.meta.url)), `starters/${name}`, target],
        { stdio: 'inherit' }
      );
      useLocalPackages(target);
      console.log(`Checking standalone copy of examples/starters/${name} in ${target}`);
      run(target, ['install', '--no-frozen-lockfile']);
      run(target, ['build']);
      if (JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')).scripts?.test) {
        run(target, ['test']);
      }
      console.log(`Standalone copy of examples/starters/${name} builds and tests successfully.`);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
});
