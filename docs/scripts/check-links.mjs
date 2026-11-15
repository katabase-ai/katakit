import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import GithubSlugger from 'github-slugger';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { buildNav } from './generate-nav.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pageRoot = join(root, 'pages');

const leaves = items =>
  items.flatMap(item => [...(item.slug ? [item.slug] : []), ...leaves(item.children ?? [])]);
const walk = (node, visit) => {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
};
const text = node => node.value ?? node.children?.map(text).join('') ?? '';

export const checkLinks = (items = buildNav()) => {
  const slugs = leaves(items);
  const known = new Set(slugs);
  const headings = new Map();
  const references = [];
  for (const slug of slugs) {
    const file = existsSync(join(pageRoot, `${slug}.md`)) ? `${slug}.md` : `${slug}/README.md`;
    const tree = fromMarkdown(readFileSync(join(pageRoot, file), 'utf8'));
    const headingSlugs = new GithubSlugger();
    const ids = new Set();
    const definitions = new Map();
    walk(tree, node => {
      if (node.type === 'heading') ids.add(headingSlugs.slug(text(node)));
      if (node.type === 'definition') definitions.set(node.identifier, node.url);
    });
    headings.set(slug, ids);
    walk(tree, node => {
      if (node.type === 'link' || node.type === 'image')
        references.push({
          slug,
          file,
          url: node.url,
          line: node.position.start.line,
          image: node.type === 'image',
        });
      if (node.type === 'linkReference' || node.type === 'imageReference') {
        const url = definitions.get(node.identifier);
        if (url)
          references.push({
            slug,
            file,
            url,
            line: node.position.start.line,
            image: node.type === 'imageReference',
          });
      }
    });
  }

  const errors = [];
  for (const { file, url, line, image } of references) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) continue;
    const target = new URL(url, `https://docs.local/${file}`);
    const filename = decodeURIComponent(target.pathname);
    const destination = filename
      .replace(/^\//, '')
      .replace(/\/README\.md$/, '')
      .replace(/\.md$/, '')
      .replace(/\/$/, '');
    const valid = image
      ? existsSync(join(root, 'public', filename))
      : known.has(destination) &&
        (!target.hash || headings.get(destination)?.has(decodeURIComponent(target.hash.slice(1))));
    if (!valid) errors.push(`${file}:${line}: broken ${image ? 'image' : 'link'} ${url}`);
  }
  return errors;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkLinks();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  }
}
