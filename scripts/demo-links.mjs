import { existsSync, lstatSync, readlinkSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const links = new Map([
  ['examples/demos/bingo-extension/src/bingo', '../../bingo-react/src/bingo'],
  [
    'examples/demos/bingo-extension/src/audio-level-meter.css',
    '../../bingo-react/src/audio-level-meter.css',
  ],
  ['examples/demos/transcription-react/src/base.css', '../../bingo-react/src/base.css'],
  [
    'examples/demos/transcription-react/src/audio-level-meter.css',
    '../../bingo-react/src/audio-level-meter.css',
  ],
]);

export const isDemoLink = (root, path) => {
  const target = links.get(relative(root, path).split(sep).join('/'));
  if (!target) return false;
  if (
    !lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink() ||
    readlinkSync(path).split(sep).join('/') !== target
  )
    throw new Error(
      `${path} must be a symlink to ${target}. Enable symlink support in your Git checkout.`
    );
  const canonical = resolve(dirname(path), target);
  if (
    !existsSync(canonical) ||
    relative(realpathSync(root), realpathSync(canonical)) !== relative(root, canonical)
  )
    throw new Error(`${path} must point to the real browser demo source at ${canonical}`);
  return true;
};

export const checkDemoLinks = (root = repository, subtree = root) => {
  for (const key of links.keys()) {
    const path = join(root, key);
    if (!relative(subtree, path).startsWith(`..${sep}`)) isDemoLink(root, path);
  }
};
