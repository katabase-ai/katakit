import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const output = join(root, 'dist/assets');
const moonshine = dirname(fileURLToPath(import.meta.resolve('@moonshine-ai/moonshine-wasm')));
const transformerRoot = dirname(require.resolve('@xenova/transformers/package.json'));
const transformerRequire = createRequire(join(transformerRoot, 'package.json'));
const onnxRoot = dirname(transformerRequire.resolve('onnxruntime-web/package.json'));

for (const [source, directory, keep] of [
  [moonshine, 'moonshine', name => /\.(?:js|mjs|wasm)$/.test(name)],
  [join(onnxRoot, 'dist'), 'onnx', name => name.endsWith('.wasm')],
]) {
  await mkdir(join(output, directory), { recursive: true });
  for (const name of await readdir(source)) {
    if (keep(name)) await copyFile(join(source, name), join(output, directory, name));
  }
}

// Preserve notices for redistributed third-party browser runtimes and their dependencies.
const notices = [];
const visited = new Set();
const packageDirectory = async (fromPackage, name) => {
  try {
    return dirname(fromPackage.resolve(`${name}/package.json`));
  } catch {
    let directory = dirname(fromPackage.resolve(name));
    while (dirname(directory) !== directory) {
      try {
        if (JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')).name === name)
          return directory;
      } catch {
        /* Continue to the dependency's package root. */
      }
      directory = dirname(directory);
    }
    throw new Error(`Could not find license metadata for ${name}`);
  }
};
const visit = async packageRoot => {
  if (visited.has(packageRoot)) return;
  visited.add(packageRoot);
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
  notices.push(
    `${manifest.name}@${manifest.version}\nLicense: ${manifest.license ?? 'See upstream source'}\n${typeof manifest.repository === 'string' ? manifest.repository : (manifest.repository?.url ?? '')}`
  );
  for (const name of await readdir(packageRoot)) {
    if (/^(?:licen[cs]e|notice|thirdpartynotices)(?:[.-]|$)/i.test(name)) {
      try {
        notices.push(await readFile(join(packageRoot, name), 'utf8'));
      } catch {
        /* Directories are not notice text. */
      }
    }
  }
  const fromPackage = createRequire(join(packageRoot, 'package.json'));
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    // These dependencies are disabled by the provider's browser map.
    if (manifest.browser?.[name] === false) continue;
    await visit(await packageDirectory(fromPackage, name));
  }
};
await visit(dirname(moonshine));
await visit(transformerRoot);
await writeFile(join(output, 'THIRD_PARTY_NOTICES.txt'), notices.join('\n\n----------------\n\n'));
