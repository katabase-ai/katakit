import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const canonical = join(root, 'examples/demos/bingo-react/src/bingo');
const standalone = join(root, 'examples/demos/bingo-extension/src/bingo');
const files = directory =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? files(join(directory, entry.name)).map(file => join(entry.name, file))
      : [entry.name]
  );

const sourceFiles = new Set(files(canonical));
const copiedFiles = new Set(files(standalone));
const contents = (directory, file) => {
  const bytes = readFileSync(join(directory, file));
  // Git can check the two text copies out with different working-tree line endings.
  return /\.(ts|md)$/.test(file)
    ? Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'))
    : bytes;
};
const differences = [...new Set([...sourceFiles, ...copiedFiles])].filter(
  file =>
    !sourceFiles.has(file) ||
    !copiedFiles.has(file) ||
    !contents(canonical, file).equals(contents(standalone, file))
);

if (differences.length) {
  throw new Error(
    `Bingo copy differs: ${differences.join(', ')}. Copy examples/demos/bingo-react/src/bingo/ to examples/demos/bingo-extension/src/bingo/ and run pnpm bingo:check-copy.`
  );
}

console.log('Bingo standalone copy matches canonical browser source.');
