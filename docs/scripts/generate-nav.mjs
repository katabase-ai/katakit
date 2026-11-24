import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = join(root, 'pages');
const output = join(root, 'src', 'nav.json');
const sectionOrder = ['why-katakit.md', 'getting-started', 'concepts', 'starters', 'reference'];
const conceptOrder = [
  'runtime.md',
  'event-history.md',
  'plugins.md',
  'persistence.md',
  'templates.md',
];
const clientStarters = [
  { label: 'React', slug: 'starters/react-web' },
  { label: 'Chrome extension', slug: 'starters/chrome-extension' },
  { label: 'Electron', slug: 'starters/electron' },
  { label: 'Obsidian', slug: 'starters/obsidian' },
];

const titleOf = path => {
  const title = readFileSync(path, 'utf8').match(/^# (.+)$/m)?.[1];
  if (!title) throw new Error(`${relative(root, path)} needs a level-one heading`);
  return title;
};

// Each directory is a section; its README is the landing page, not a duplicate child.
export const buildNav = (directory = pages) => {
  const isRoot = directory === pages;
  const items = readdirSync(directory, { withFileTypes: true })
    .filter(
      entry =>
        entry.isDirectory() ||
        (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
    )
    .toSorted((a, b) => {
      if (isRoot) {
        const left = sectionOrder.indexOf(a.name);
        const right = sectionOrder.indexOf(b.name);
        if (left !== right) return (left < 0 ? Infinity : left) - (right < 0 ? Infinity : right);
      }
      // The tutorial's learning sequence is independent of its existing URL names.
      if (directory === join(pages, 'concepts'))
        return conceptOrder.indexOf(a.name) - conceptOrder.indexOf(b.name);
      return (
        Number(a.isDirectory()) - Number(b.isDirectory()) || a.name.localeCompare(b.name, 'en')
      );
    })
    .map(entry => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        const landing = join(path, 'README.md');
        return {
          label: existsSync(landing) ? titleOf(landing) : entry.name.replaceAll('-', ' '),
          ...(existsSync(landing) ? { slug: relative(pages, path).split(sep).join('/') } : {}),
          children: buildNav(path),
        };
      }
      return {
        label: titleOf(path),
        slug: relative(pages, path).split(sep).join('/').replace(/\.md$/, ''),
      };
    })
    .filter(item => item.slug || item.children.length);

  // Order application starters without changing their published page URLs or titles.
  if (directory === join(pages, 'starters')) {
    const clients = clientStarters.map(starter => {
      const item = items.find(item => item.slug === starter.slug);
      if (!item) throw new Error(`Missing client starter page: ${starter.slug}`);
      return { ...item, label: starter.label };
    });
    return [
      ...clients,
      // Keep the WIP MCP App page addressable, but omit it from navigation for now.
      ...items.filter(
        item =>
          item.slug !== 'starters/mcp-app' &&
          !clientStarters.some(starter => starter.slug === item.slug)
      ),
    ];
  }

  // Package pages are peers in Reference; existing plugin URLs remain valid.
  if (directory === join(pages, 'reference'))
    return items
      .flatMap(item => (item.slug === 'reference/plugins' ? item.children : [item]))
      .toSorted((a, b) => a.label.localeCompare(b.label, 'en'));
  return items;
};

export const generateNav = ({ check = false } = {}) => {
  const content = `${JSON.stringify(buildNav(), null, 2)}\n`;
  if (check) {
    if (readFileSync(output, 'utf8') !== content) {
      throw new Error(
        'docs/src/nav.json is stale; run pnpm -F @katakit/docs dev or pnpm --filter @katakit/docs exec node scripts/generate-nav.mjs'
      );
    }
  } else {
    writeFileSync(output, content);
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateNav({ check: process.argv.includes('--check') });
}
