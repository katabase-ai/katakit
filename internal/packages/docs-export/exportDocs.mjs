import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';
import { Application } from 'typedoc';
import ts from 'typescript';
import { remark } from 'remark';
import GithubSlugger from 'github-slugger';
import remarkGfm from 'remark-gfm';
import { buildNav } from '../../../docs/scripts/generate-nav.mjs';
import { checkLinks } from '../../../docs/scripts/check-links.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../..');
const packages = [
  'core',
  'event-log',
  'persistence',
  'transcript-ingestion',
  'transcription',
  'react',
];
const walk = (node, visit) => {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
};
const textOf = node => node.value ?? node.children?.map(textOf).join('') ?? '';
const filesIn = async directory =>
  (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map(async entry => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? filesIn(path) : [path];
      })
    )
  ).flat();

/** README landing pages retain their logical directory identity in every consumer. */
export const guideSlug = path => path.replace(/(?:^|\/)README\.md$/, '').replace(/\.md$/, '');

/** Rewrite through the complete page inventory, rejecting missing targets before publication. */
export const rewriteLinks = ({ markdown, file, destinations }) => {
  const processor = remark().use(remarkGfm);
  const tree = processor.parse(markdown);
  walk(tree, node => {
    if (!['link', 'image', 'definition'].includes(node.type) || !node.url) return;
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(node.url)) return;
    const target = new URL(node.url, `https://docs.local/${file}`);
    const path = decodeURIComponent(target.pathname.slice(1));
    const destination = destinations[path];
    if (!destination) throw new Error(`${file}: unresolved documentation link ${node.url}`);
    node.url = `${posix.relative(posix.dirname(destinations[file]), destination) || posix.basename(destination)}${target.search}${target.hash}`;
  });
  return processor.stringify(tree);
};

/** Export only documentation projections; consumer-specific routes and React stay outside this tool. */
export const exportDocs = async ({ output }) => {
  const started = performance.now();
  const guideErrors = checkLinks();
  if (guideErrors.length) throw new Error(guideErrors.join('\n'));
  if (ts.version !== '6.0.3') throw new Error(`Unexpected reference compiler ${ts.version}`);
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const dirty = Boolean(
    execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()
  );
  await rm(output, { recursive: true, force: true });
  await mkdir(join(output, 'content'), { recursive: true });
  const entryPoints = [];
  const coverage = [];
  const nonCodeExports = [];
  const config = ts.readConfigFile(join(directory, 'tsconfig.reference.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, directory);
  for (const name of packages) {
    const packageRoot = join(root, 'pkgs', name);
    const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
    const exports = Object.entries(manifest.exports);
    for (const [subpath, conditions] of exports) {
      if (typeof conditions === 'string' && conditions.endsWith('.json')) {
        nonCodeExports.push({ package: manifest.name, subpath, target: conditions });
        continue;
      }
      if (!conditions.source) throw new Error(`${manifest.name} ${subpath} has no source export`);
      entryPoints.push(join(packageRoot, conditions.source));
      coverage.push({
        package: manifest.name,
        subpath,
        sourcePath: relative(root, join(packageRoot, conditions.source)),
      });
    }
  }
  const program = ts.createProgram(entryPoints, parsed.options);
  const checker = program.getTypeChecker();
  coverage.forEach((entry, index) => {
    const source = program.getSourceFile(entryPoints[index]);
    if (!source) throw new Error(`Missing TypeScript public entry point ${entry.sourcePath}`);
    const symbol = checker.getSymbolAtLocation(source);
    entry.symbols = symbol
      ? checker
          .getExportsOfModule(symbol)
          .map(item => item.name)
          .toSorted()
      : [];
  });
  const extractionStarted = performance.now();
  const app = await Application.bootstrapWithPlugins({
    plugin: ['typedoc-plugin-markdown'],
    tsconfig: join(directory, 'tsconfig.reference.json'),
    entryPoints: entryPoints.filter((_, index) => coverage[index].symbols.length),
    name: 'Katakit API',
    readme: 'none',
    out: join(output, '.reference'),
    gitRevision: revision,
    sourceLinkTemplate: `https://github.com/katabase-ai/katakit/blob/${revision}/{path}#L{line}`,
    basePath: root,
    excludePrivate: true,
    excludeInternal: true,
    entryFileName: 'README.md',
    outputFileStrategy: 'members',
    hidePageHeader: true,
    hideBreadcrumbs: true,
    validation: { notExported: false, invalidLink: true, notDocumented: false },
  });
  const project = await app.convert();
  if (!project || app.logger.hasErrors()) throw new Error('Public API conversion failed');
  app.validate(project);
  if (app.logger.hasErrors()) throw new Error('Public API validation failed');
  for (const entry of coverage) {
    if (!entry.symbols.length) continue;
    const moduleName = entry.sourcePath.replace(/\/index\.ts$/, '').replace(/\.tsx?$/, '');
    const module = project.children.find(child => child.name === moduleName);
    if (!module) throw new Error(`${entry.package}: missing exported module ${moduleName}`);
    const names = (module.children ?? []).map(reflection => reflection.name);
    const missing = entry.symbols.filter(name => !names.includes(name));
    if (missing.length) throw new Error(`${entry.package}: omitted exports ${missing.join(', ')}`);
  }
  await app.generateOutputs(project);
  if (app.logger.hasErrors()) throw new Error('API Markdown generation failed');
  const extractionMs = performance.now() - extractionStarted;
  const guideRoot = join(root, 'docs/pages');
  const guideFiles = (await filesIn(guideRoot)).filter(file => file.endsWith('.md'));
  const destinations = Object.fromEntries(
    guideFiles.map(file => [
      relative(guideRoot, file),
      `${guideSlug(relative(guideRoot, file))}.md`,
    ])
  );
  const assets = [];
  const publicRoot = join(root, 'docs/public');
  if (existsSync(publicRoot)) {
    for (const file of await filesIn(publicRoot)) {
      const asset = relative(publicRoot, file);
      destinations[asset] = `assets/${asset}`;
      await mkdir(dirname(join(output, 'content', destinations[asset])), { recursive: true });
      await cp(file, join(output, 'content', destinations[asset]));
      assets.push(`content/${destinations[asset]}`);
    }
  }
  const pages = [];
  for (const file of guideFiles) {
    const sourceFile = relative(guideRoot, file);
    const slug = guideSlug(sourceFile);
    const markdown = rewriteLinks({
      markdown: await readFile(file, 'utf8'),
      file: sourceFile,
      destinations,
    });
    await mkdir(dirname(join(output, 'content', `${slug}.md`)), { recursive: true });
    await writeFile(join(output, 'content', `${slug}.md`), markdown);
    pages.push({
      slug,
      kind: 'guide',
      title: textOf(
        remark()
          .parse(markdown)
          .children.find(node => node.type === 'heading')
      ),
      file: `content/${slug}.md`,
      sourcePath: relative(root, file),
    });
  }
  const referenceRoot = join(output, '.reference');
  const referenceFiles = (await filesIn(referenceRoot)).filter(file => file.endsWith('.md'));
  const referenceDestinations = Object.fromEntries(
    referenceFiles.map(file => {
      const original = relative(referenceRoot, file);
      return [
        original,
        `${guideSlug(`api/${original.replace(/^pkgs\/([^/]+)\/src(?=\/)/, '$1')}`)}.md`,
      ];
    })
  );
  for (const file of referenceFiles) {
    const original = relative(referenceRoot, file);
    const exported = referenceDestinations[original];
    const markdown = rewriteLinks({
      markdown: (await readFile(file, 'utf8')).replace(/^# pkgs\/([^/]+)\/src$/m, '# @katakit/$1'),
      file: original,
      destinations: referenceDestinations,
    });
    await mkdir(dirname(join(output, 'content', exported)), { recursive: true });
    await writeFile(join(output, 'content', exported), markdown);
    pages.push({
      slug: exported.replace(/\.md$/, ''),
      kind: 'api',
      title: textOf(
        remark()
          .parse(markdown)
          .children.find(node => node.type === 'heading')
      ),
      file: `content/${exported}`,
    });
  }
  await rm(referenceRoot, { recursive: true });
  const exportedPages = Object.fromEntries(pages.map(page => [page.file, page]));
  for (const page of pages) {
    const slugger = new GithubSlugger();
    const tree = remark()
      .use(remarkGfm)
      .parse(await readFile(join(output, page.file), 'utf8'));
    page.headings = [];
    walk(tree, node => {
      if (node.type === 'heading')
        page.headings.push({
          depth: node.depth,
          text: textOf(node),
          id: slugger.slug(textOf(node)),
        });
    });
  }
  for (const page of pages) {
    const tree = remark()
      .use(remarkGfm)
      .parse(await readFile(join(output, page.file), 'utf8'));
    walk(tree, node => {
      if (
        !['link', 'image', 'definition'].includes(node.type) ||
        !node.url ||
        /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(node.url)
      )
        return;
      const target = new URL(node.url, `https://docs.local/${page.file}`);
      const destination = decodeURIComponent(target.pathname.slice(1));
      const linked = exportedPages[destination];
      if (!linked && !assets.includes(destination))
        throw new Error(`${page.file}: missing exported target ${node.url}`);
      if (
        linked &&
        target.hash &&
        !linked.headings.some(heading => heading.id === decodeURIComponent(target.hash.slice(1)))
      )
        throw new Error(`${page.file}: missing exported anchor ${node.url}`);
    });
  }
  const slugs = pages.map(page => page.slug);
  if (new Set(slugs).size !== slugs.length) throw new Error('Duplicate exported page slugs');
  const apiNavigation = pages
    .filter(page => page.kind === 'api' && /^api\/[^/]+$/.test(page.slug))
    .map(page => ({
      label: page.title,
      slug: page.slug,
      children: pages
        .filter(child => child.slug.startsWith(`${page.slug}/`))
        .map(child => ({ label: child.title, slug: child.slug })),
    }));
  const manifest = {
    formatVersion: 1,
    revision,
    dirty,
    tools: { typescript: ts.version, typedoc: Application.VERSION, markdown: '4.14.1' },
    timings: { extractionMs, exportMs: performance.now() - started },
    packages: coverage,
    nonCodeExports,
    navigation: [...buildNav(), { label: 'API reference', slug: 'api', children: apiNavigation }],
    pages,
    assets,
  };
  await writeFile(join(output, 'manifest.json'), `${JSON.stringify(manifest, undefined, 2)}\n`);
  process.stdout.write(
    `Exported ${pages.length} pages from ${revision}${dirty ? ' (dirty)' : ''} with TypeScript ${ts.version}\n`
  );
  return manifest;
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({
    options: { output: { type: 'string', default: join(root, 'dist/docs') } },
  });
  await exportDocs({ output: resolve(values.output) });
}
