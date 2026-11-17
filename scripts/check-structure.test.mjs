import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkStructure } from './check-structure.mjs';

const fixture = t => {
  const root = mkdtempSync(join(tmpdir(), 'katakit-structure-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const manifest = (path, change) => {
    const file = join(root, path, 'package.json');
    const value = JSON.parse(readFileSync(file, 'utf8'));
    change(value);
    writeFileSync(file, JSON.stringify(value));
  };
  write(
    'pnpm-workspace.yaml',
    "packages:\n  - 'pkgs/*'\n  - 'internal/packages/*'\n  - 'examples/demos/*'\n  - 'docs'\n\nlinkWorkspacePackages: true\n"
  );
  write(
    'pkgs/core/package.json',
    JSON.stringify({
      name: '@katakit/core',
      version: '0.0.0',
      publishConfig: { access: 'public' },
      devDependencies: { '@katakit/docs-export': 'workspace:*' },
    })
  );
  write('pkgs/core/src/index.ts', 'export const value = 1;');
  write(
    'internal/packages/docs-export/package.json',
    JSON.stringify({ name: '@katakit/docs-export', private: true })
  );
  write('internal/site-ui/styles.css', "@import './components.css';");
  write('internal/site-ui/components.css', '.site-button { display: block; }');
  for (const [path, name] of [
    ['demos/bingo-react', '@katakit/demo-bingo-react'],
    ['demos/gallery', '@katakit/gallery'],
    ['starters/react-web', '@katakit/react-starter'],
  ]) {
    write(
      `examples/${path}/package.json`,
      JSON.stringify({
        name,
        private: true,
        scripts: { build: 'vite build' },
        dependencies: { '@katakit/core': '0.0.0' },
      })
    );
    write(`examples/${path}/README.md`, '# Example');
    write(`examples/${path}/LICENSE`, 'fixture license');
    write(`examples/${path}/src/main.ts`, 'export const value = 1;');
  }
  write('examples/demos/gallery/shared/view.ts', "import '../../bingo-react/src/main';");
  write(
    'examples/demos/gallery/shared/style.css',
    "@import '../../../../internal/site-ui/components.css';"
  );
  return { root, write, manifest };
};
const rejects = (t, mutate, expected) => {
  const setup = fixture(t);
  mutate(setup);
  assert.ok(
    checkStructure(setup.root).some(problem => expected.test(problem)),
    `Expected ${expected}`
  );
};

test('public libraries, private tools, CSS assets, composed gallery, and independent examples pass', t => {
  const { root, write, manifest } = fixture(t);
  write('examples/starters/react-web/vendor/core.tgz', 'bundled library fixture');
  manifest('examples/starters/react-web', value => {
    value.dependencies['@katakit/core'] = 'file:vendor/core.tgz';
  });
  assert.deepEqual(checkStructure(root), []);
});
test('private packages cannot live under pkgs', t =>
  rejects(
    t,
    ({ manifest }) =>
      manifest('pkgs/core', value => {
        value.private = true;
      }),
    /pkgs\/ requires/
  ));
test('internal build tools must stay private', t =>
  rejects(
    t,
    ({ manifest }) =>
      manifest('internal/packages/docs-export', value => {
        delete value.private;
      }),
    /tool packages must declare private/
  ));
test('published runtime dependencies cannot include private tools', t =>
  rejects(
    t,
    ({ manifest }) =>
      manifest('pkgs/core', value => {
        value.dependencies = { '@katakit/docs-export': 'workspace:*' };
      }),
    /cannot distribute a private tool/
  ));
test('published source cannot reach into internal assets', t =>
  rejects(
    t,
    ({ write }) =>
      write('pkgs/core/src/index.ts', "import '../../../internal/site-ui/styles.css';"),
    /escapes its library directory/
  ));
test('published source cannot import private package entry points', t =>
  rejects(
    t,
    ({ write }) => write('pkgs/core/src/index.ts', "import '@katakit/docs-export/private';"),
    /cannot import private workspace package/
  ));
test('feature demos cannot import a sibling example', t =>
  rejects(
    t,
    ({ write }) =>
      write('examples/demos/bingo-react/src/main.ts', "import '../../gallery/shared/view';"),
    /escapes its demo directory/
  ));
test('demo manifests reject workspace protocols', t =>
  rejects(
    t,
    ({ manifest }) =>
      manifest('examples/demos/bingo-react', value => {
        value.dependencies['@katakit/core'] = 'workspace:*';
      }),
    /must use an installable registry version/
  ));
test('examples cannot add private workspace dependencies with ordinary versions', t =>
  rejects(
    t,
    ({ manifest }) =>
      manifest('examples/demos/gallery', value => {
        value.dependencies['@katakit/docs-export'] = '0.0.0';
      }),
    /cannot depend on a private workspace package/
  ));
test('CSS assets cannot acquire a package manifest or React source', t => {
  const { root, write } = fixture(t);
  write('internal/site-ui/package.json', '{"private":true}');
  write('internal/site-ui/Button.tsx', 'export const Button = () => <button />;');
  const problems = checkStructure(root);
  assert.ok(problems.some(problem => problem.includes('manifests belong directly')));
  assert.ok(problems.some(problem => problem.includes('Button.tsx: internal/site-ui is CSS-only')));
});
test('shared CSS cannot import files elsewhere in the repository', t =>
  rejects(
    t,
    ({ write }) =>
      write(
        'internal/site-ui/styles.css',
        "@import '../../examples/demos/gallery/shared/style.css';"
      ),
    /shared CSS imports must stay inside/
  ));
test('other private tools cannot create manifests outside internal/packages', t =>
  rejects(
    t,
    ({ write }) => write('internal/loose-tool/package.json', '{"private":true}'),
    /manifests belong directly/
  ));
test('starters and plain assets cannot become workspace packages', t =>
  rejects(
    t,
    ({ write }) =>
      write('pnpm-workspace.yaml', "packages:\n  - 'pkgs/*'\n  - 'examples/*'\n  - 'internal/*'\n"),
    /starters and plain assets stay outside/
  ));
test('old root example directories are rejected', t =>
  rejects(t, ({ write }) => write('templates/old/package.json', '{}'), /examples belong under/));
test('symlinks in example sources are rejected', { skip: process.platform === 'win32' }, t =>
  rejects(
    t,
    ({ root }) => symlinkSync('main.ts', join(root, 'examples/demos/bingo-react/src/linked.ts')),
    /must be regular files, not symlinks/
  )
);
