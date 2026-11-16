import { cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const transcriptionAssetsDirectory = join(
  dirname(fileURLToPath(import.meta.resolve('@katakit/transcription/package.json'))),
  'dist/assets'
);

/** Copy shipped runtime assets for any static server or bundler. Does not download models. */
export const copyTranscriptionAssets = async (destination: string) => {
  await mkdir(destination, { recursive: true });
  await cp(transcriptionAssetsDirectory, destination, { recursive: true });
};

export const listTranscriptionAssets = async (
  directory = transcriptionAssetsDirectory,
  prefix = ''
) => {
  const files: string[] = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listTranscriptionAssets(directory, name)));
    else if (entry.isFile()) files.push(name);
  }
  return files;
};
