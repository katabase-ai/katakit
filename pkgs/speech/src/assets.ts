import { cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const speechAssetsDirectory = join(
  dirname(fileURLToPath(import.meta.resolve('@katakit/speech/package.json'))),
  'dist/assets'
);

/** Copy shipped runtime assets for any static server or bundler. Does not download models. */
export const copySpeechAssets = async (destination: string) => {
  await mkdir(destination, { recursive: true });
  await cp(speechAssetsDirectory, destination, { recursive: true });
};

export const listSpeechAssets = async (directory = speechAssetsDirectory, prefix = '') => {
  const files: string[] = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listSpeechAssets(directory, name)));
    else if (entry.isFile()) files.push(name);
  }
  return files;
};
