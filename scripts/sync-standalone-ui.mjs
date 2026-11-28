import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const repository = fileURLToPath(new URL('../', import.meta.url));
const demos = ['bingo', 'transcription', 'color-clash', 'notes', 'list-extraction', 'word-rush'];
const files = ['StandaloneDemo.tsx', 'CaptureControls.tsx', 'standalone.css'];
export const syncStandaloneUi = (root = repository, check = false) => {
  const differences = [];
  for (const name of demos) {
    for (const file of files) {
      // Color Clash's only capture action is Play inside the game; it needs no generic control.
      if (name === 'color-clash' && file === 'CaptureControls.tsx') continue;
      const source = readFileSync(join(root, 'scripts/standalone-ui', file));
      const relativePath = `examples/demos/${name}/src/${file === 'standalone.css' ? '' : 'ui/'}${file}`;
      const target = join(root, relativePath);
      let existing;
      try {
        existing = readFileSync(target);
      } catch {
        // A missing copy fails the check and is created by the refresh command.
      }
      if (existing?.equals(source)) continue;
      differences.push(relativePath);
      if (!check) {
        mkdirSync(join(root, 'examples/demos', name, 'src/ui'), { recursive: true });
        writeFileSync(target, source);
      }
    }
  }
  return differences;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const differences = syncStandaloneUi(repository, check);
  if (check && differences.length) {
    console.error(differences.map(path => `Standalone UI copy differs: ${path}`).join('\n'));
    process.exitCode = 1;
  } else console.log(check ? 'Standalone UI copies match.' : 'Standalone UI copies refreshed.');
}
