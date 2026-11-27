import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTemplateManifests } from './check-template-manifests.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.wrangler',
  '.tanstack',
]);
const dependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];
const runtimeFields = ['dependencies', 'optionalDependencies', 'peerDependencies'];
const inside = (parent, target) => {
  const path = relative(parent, target);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
};
const entries = directory =>
  existsSync(directory)
    ? readdirSync(directory, { withFileTypes: true }).filter(
        entry => !ignored.has(entry.name) && !entry.name.startsWith('.env')
      )
    : [];
const imports =
  /(?:\b(?:import|export)\s+(?:[^`'";]*?\bfrom\s*)?|\bimport\s*\(\s*|\brequire\s*\(\s*|@import\s+(?:url\(\s*)?)([`'"])([^`'"]+)\1/g;

/** Small filesystem checks; builds and independent-copy checks remain the portability proof. */
export const checkStructure = (root = repository) => {
  const problems = [];
  const report = (path, message) => problems.push(`${relative(root, path)}: ${message}`);
  const walk = (directory, visit) => {
    for (const entry of entries(directory)) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink())
        report(path, 'source and assets must be regular files, not symlinks');
      else if (entry.isDirectory()) walk(path, visit);
      else visit(path);
    }
  };
  const packages = (directory, kind) =>
    entries(join(root, directory))
      .filter(entry => entry.isDirectory() && entries(join(root, directory, entry.name)).length)
      .flatMap(entry => {
        const path = join(root, directory, entry.name);
        try {
          return [
            { path, kind, manifest: JSON.parse(readFileSync(join(path, 'package.json'), 'utf8')) },
          ];
        } catch {
          report(path, 'requires a valid package.json');
          return [];
        }
      });
  for (const legacy of ['demos', 'templates']) {
    if (entries(join(root, legacy)).length)
      report(join(root, legacy), 'examples belong under examples/demos or examples/starters');
  }
  const workspace = join(root, 'pnpm-workspace.yaml');
  const yaml = existsSync(workspace) ? readFileSync(workspace, 'utf8') : '';
  const section = yaml.match(/^packages:\s*\n((?:[ \t]+[^\n]*\n|\n)*)/m)?.[1] ?? '';
  const patterns = [...section.matchAll(/^\s*-\s*['"]?([^'"\s#]+)['"]?\s*$/gm)]
    .map(match => match[1])
    .toSorted();
  const expected = ['pkgs/*', 'internal/pkgs/*', 'examples/demos/*', 'docs', 'gallery'].toSorted();
  if (JSON.stringify(patterns) !== JSON.stringify(expected))
    report(
      workspace,
      `workspace packages must be ${expected.join(', ')}; starters and plain assets stay outside`
    );

  for (const directory of ['pkgs', 'internal/pkgs', 'examples/demos', 'examples/starters']) {
    for (const entry of entries(join(root, directory))) {
      if (entry.isSymbolicLink())
        report(join(root, directory, entry.name), 'package directories must not be symlinks');
    }
  }
  const libraries = packages('pkgs', 'library');
  const tools = packages('internal/pkgs', 'tool');
  const demos = packages('examples/demos', 'demo');
  const starters = packages('examples/starters', 'starter');
  const gallery = [];
  if (lstatSync(join(root, 'gallery'), { throwIfNoEntry: false })?.isSymbolicLink())
    report(join(root, 'gallery'), 'package directories must not be symlinks');
  try {
    gallery.push({
      path: join(root, 'gallery'),
      kind: 'gallery',
      manifest: JSON.parse(readFileSync(join(root, 'gallery/package.json'), 'utf8')),
    });
  } catch {
    report(join(root, 'gallery'), 'requires a valid package.json');
  }
  const all = [...libraries, ...tools, ...demos, ...starters, ...gallery];
  const publicNames = new Set(libraries.map(pkg => pkg.manifest.name));
  const privateNames = new Set(
    [...tools, ...demos, ...starters, ...gallery]
      .map(pkg => pkg.manifest.name)
      .concat('@katakit/docs')
  );
  for (const { path, kind, manifest } of all) {
    if (kind === 'library') {
      if (
        manifest.private === true ||
        !/^@katakit\/[a-z0-9-]+$/.test(manifest.name ?? '') ||
        !manifest.version ||
        manifest.publishConfig?.access !== 'public'
      ) {
        report(
          path,
          'pkgs/ requires a versioned, public @katakit library; move private tools to internal/pkgs/'
        );
      }
      for (const field of runtimeFields) {
        for (const [name, version] of Object.entries(manifest[field] ?? {})) {
          if (
            typeof version !== 'string' ||
            privateNames.has(name) ||
            (name.startsWith('@katakit/') && !publicNames.has(name)) ||
            /^(?:file:|link:|portal:)/.test(version) ||
            (version.startsWith('workspace:') && !publicNames.has(name))
          ) {
            report(
              path,
              `${field}.${name} cannot distribute a private tool, application, or local path`
            );
          }
        }
      }
    } else if (manifest.private !== true)
      report(path, `${kind} packages must declare private: true`);
    if (kind === 'demo' || kind === 'starter' || kind === 'gallery') {
      for (const field of dependencyFields) {
        for (const name of Object.keys(manifest[field] ?? {})) {
          if (privateNames.has(name) || (name.startsWith('@katakit/') && !publicNames.has(name)))
            report(path, `${field}.${name} cannot depend on a private workspace package`);
        }
      }
    }
    if (kind === 'tool') continue;
    // Only the gallery composes sibling demos and plain CSS. Other examples own every input.
    const scope = kind === 'library' ? join(path, 'src') : path;
    walk(scope, file => {
      if (!/\.(?:[cm]?[jt]sx?|css)$/.test(file)) return;
      for (const match of readFileSync(file, 'utf8').matchAll(imports)) {
        const specifier = match[2];
        if (specifier.includes('${')) continue;
        if (
          [...privateNames].some(name => specifier === name || specifier.startsWith(`${name}/`))
        ) {
          report(file, `cannot import private workspace package ${specifier}`);
        }
        if (!specifier.startsWith('.')) continue;
        const target = resolve(dirname(file), specifier.split(/[?#]/)[0]);
        const gallerySource =
          kind === 'gallery' &&
          path === join(root, 'gallery') &&
          manifest.name === '@katakit/gallery' &&
          ([
            'bingo',
            'transcription',
            'notes',
            'list-extraction',
            'word-rush',
            'color-clash',
          ].some(name => inside(join(root, 'examples/demos', name, 'src'), target)) ||
            (file.endsWith('.css') &&
              target.endsWith('.css') &&
              inside(join(root, 'internal/site-ui'), target)));
        if (!inside(path, target) && !gallerySource)
          report(file, `import ${specifier} escapes its ${kind} directory`);
      }
    });
  }
  for (const directory of ['examples/demos', 'examples/starters']) {
    if (existsSync(join(root, directory))) {
      problems.push(
        ...checkTemplateManifests(join(root, directory)).map(problem => `${directory}/${problem}`)
      );
    }
  }
  problems.push(...checkTemplateManifests(root, ['gallery']));
  walk(join(root, 'internal'), file => {
    if (
      file.endsWith(`${sep}package.json`) &&
      !tools.some(tool => file === join(tool.path, 'package.json'))
    ) {
      report(file, 'internal workspace manifests belong directly under internal/pkgs/<name>/');
    }
  });
  walk(join(root, 'internal/site-ui'), file => {
    if (!file.endsWith('.css'))
      report(file, 'internal/site-ui is CSS-only; markup and behavior belong to consumers');
    else {
      for (const match of readFileSync(file, 'utf8').matchAll(imports)) {
        if (
          match[2].startsWith('.') &&
          !inside(join(root, 'internal/site-ui'), resolve(dirname(file), match[2]))
        )
          report(file, 'shared CSS imports must stay inside internal/site-ui');
      }
    }
  });
  return [...new Set(problems)].toSorted();
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkStructure();
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
  } else
    console.log(
      'Package placement, dependency boundaries, CSS-only assets, and example manifests OK.'
    );
}
