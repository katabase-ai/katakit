import { cpSync, existsSync, lstatSync, readlinkSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const demoNames = ['bingo-react', 'bingo-extension', 'transcription-react'];

// Links only exist in the workspace. Exported examples contain real files.
const links = new Map([
  ['demos/bingo-extension/src/bingo', '../../bingo-react/src/bingo'],
  ['demos/bingo-extension/src/audio-level-meter.css', '../../bingo-react/src/audio-level-meter.css'],
  ['demos/transcription-react/src/base.css', '../../bingo-react/src/base.css'],
  ['demos/transcription-react/src/audio-level-meter.css', '../../bingo-react/src/audio-level-meter.css'],
]);

export const checkDemoLinks = () => {
  for (const [path, target] of links) {
    const fullPath = join(root, path);
    if (!lstatSync(fullPath).isSymbolicLink() || readlinkSync(fullPath) !== target) {
      throw new Error(`${path} must be a symlink to ${target}. Enable symlink support in your Git checkout.`);
    }
    if (!existsSync(resolve(dirname(fullPath), target))) {
      throw new Error(`${path} points to a missing source`);
    }
  }
};

const ignored = new Set(['node_modules', 'dist', 'coverage', 'vendor']);

export const exportDemo = (name, destination) => {
  if (!demoNames.includes(name)) throw new Error(`Unknown demo: ${name}. Choose ${demoNames.join(', ')}.`);
  if (!destination) throw new Error('Provide a destination directory.');
  const source = join(root, 'demos', name);
  const target = resolve(destination);
  if (target === source || target.startsWith(source + sep)) {
    throw new Error('Export outside the source demo directory.');
  }
  if (existsSync(target)) throw new Error(`Destination already exists: ${target}`);

  checkDemoLinks();
  cpSync(source, target, {
    recursive: true,
    dereference: true,
    filter(path) {
      const subpath = relative(source, path);
      if (subpath && (ignored.has(basename(path)) || subpath.endsWith('.tsbuildinfo'))) return false;
      if (lstatSync(path).isSymbolicLink()) {
        const key = relative(root, path).split(sep).join('/');
        if (!links.has(key)) throw new Error(`Unexpected symlink in example: ${key}`);
      }
      return true;
    },
  });
  return target;
};
