import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDemoLinks, isDemoLink } from './demo-links.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const [example, destination] = args[0] === '--demo' ? [`demos/${args[1]}`, args[2]] : args;
if (!/^(demos|starters)\/[a-z0-9-]+$/.test(example ?? '') || !destination) {
  throw new Error('Usage: pnpm examples:copy <demos/name|starters/name> <new-directory>');
}
const source = join(root, 'examples', example);
const target = resolve(destination);
if (!existsSync(join(source, 'package.json'))) throw new Error(`Unknown example: ${example}`);
// lstat also catches dangling symlinks, which existsSync treats as absent.
if (lstatSync(target, { throwIfNoEntry: false }))
  throw new Error(`Destination already exists: ${target}`);
// Resolve existing ancestors so a path through an external symlink cannot land in this checkout.
let ancestor = resolve(target, '..');
const missing = [];
while (!lstatSync(ancestor, { throwIfNoEntry: false })) {
  missing.unshift(ancestor.split(sep).at(-1));
  ancestor = resolve(ancestor, '..');
}
const physicalTarget = join(realpathSync(ancestor), ...missing, target.split(sep).at(-1));
const inside = relative(realpathSync(root), physicalTarget);
if (!inside || (inside !== '..' && !inside.startsWith(`..${sep}`) && !isAbsolute(inside)))
  throw new Error('Choose a destination outside this checkout');
// A copy must not capture credentials, generated output, dependencies, or external symlinks.
const copy = (from, to) => {
  checkDemoLinks(root, from);
  cpSync(from, to, {
    recursive: true,
    dereference: true,
    filter: path => {
      const parts = relative(from, path).split(sep);
      if (
        parts.some(
          part =>
            [
              'node_modules',
              'dist',
              '.git',
              '.wrangler',
              '.tanstack',
              'coverage',
              'vendor',
            ].includes(part) ||
            (part.startsWith('.env') && part !== '.env.example')
        )
      )
        return false;
      if (lstatSync(path).isSymbolicLink() && !isDemoLink(root, path))
        throw new Error(`Unexpected symlink in example: ${path}`);
      return true;
    },
  });
};
// Reserve a new directory so a failed copy can remove only its own output.
mkdirSync(dirname(target), { recursive: true });
mkdirSync(target);
try {
  copy(source, target);
  if (example === 'demos/gallery') {
    copy(join(root, 'internal/site-ui'), join(target, 'styles'));
    // The gallery is a composition: carry each imported example's source in this copy.
    for (const name of ['bingo-react', 'transcription-react', 'notes-react']) {
      copy(join(root, 'examples/demos', name, 'src'), join(target, 'sources', name, 'src'));
    }
    const rewrite = directory => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) rewrite(path);
        else if (/\.(tsx?|css)$/.test(entry.name)) {
          const text = readFileSync(path, 'utf8')
            .replace(
              /\.\.\/\.\.\/(bingo-react|transcription-react|notes-react)\//g,
              '../sources/$1/'
            )
            .replaceAll('../../../../internal/site-ui/', '../styles/');
          writeFileSync(path, text);
        }
      }
    };
    rewrite(join(target, 'src'));
    rewrite(join(target, 'shared'));
  }
} catch (error) {
  rmSync(target, { recursive: true, force: true });
  throw error;
}
console.log(
  `Copied ${example} to ${target}. Run pnpm install, pnpm build, and the README's run command there.`
);
