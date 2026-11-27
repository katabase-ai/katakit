import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const canonical = join(root, 'examples/demos/bingo-react/src/bingo');
const canonicalTests = join(root, 'examples/demos/bingo-react/tests');
const standalone = join(root, 'examples/demos/bingo-extension/src/bingo');
const files = directory =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? files(join(directory, entry.name)).map(file => join(entry.name, file))
      : [entry.name]
  );

// Tests live outside browser source, but remain checked against the extension's local copies.
const sourceFiles = new Map(files(canonical).map(file => [file, join(canonical, file)]));
for (const file of files(canonicalTests)) {
  if (sourceFiles.has(file)) throw new Error(`Duplicate canonical Bingo file: ${file}`);
  sourceFiles.set(file, join(canonicalTests, file));
}
const copiedFiles = new Set(files(standalone));
const contents = (path, relocatedTest = false) => {
  const bytes = readFileSync(path);
  // Git can check the two text copies out with different working-tree line endings.
  if (!/\.(ts|md)$/.test(path)) return bytes;
  let text = bytes.toString('utf8').replaceAll('\r\n', '\n');
  // Only normalize the import prefix changed by relocating the browser tests.
  if (relocatedTest) text = text.replace(/(\bfrom\s+['"])\.\.\/src\/bingo\//g, '$1./');
  return Buffer.from(text);
};
const differences = [...new Set([...sourceFiles.keys(), ...copiedFiles])].filter(
  file =>
    !sourceFiles.has(file) ||
    !copiedFiles.has(file) ||
    !contents(sourceFiles.get(file), sourceFiles.get(file) === join(canonicalTests, file)).equals(
      contents(join(standalone, file))
    )
);

if (differences.length) {
  throw new Error(
    `Bingo copy differs: ${differences.join(', ')}. Sync browser src/bingo/ and tests/ into examples/demos/bingo-extension/src/bingo/ (adjust test imports to ./) and run pnpm bingo:check-copy.`
  );
}

console.log('Bingo standalone copy matches canonical browser source.');
