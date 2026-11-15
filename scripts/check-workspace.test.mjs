import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkWorkspace } from './check-workspace.mjs';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));

const fixture = run => {
  const root = mkdtempSync(join(tmpdir(), 'workspace-check-'));
  try {
    cpSync(join(repo, 'LICENSE'), join(root, 'LICENSE'));
    const add = (location, manifest) => {
      const directory = join(root, location);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest));
      return { path: directory };
    };
    run(root, add);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test('license errors fail, but missing guidance and documentation only warn', () => {
  fixture((root, add) => {
    const pkg = add('pkgs/example', { name: '@katakit/example' });
    const { errors, warnings } = checkWorkspace(root, [pkg]);
    assert.match(errors.join('\n'), /expected "license"/);
    assert.match(errors.join('\n'), /missing package-local LICENSE/);
    assert.match(warnings.join('\n'), /missing package-local AGENTS.md/);
    assert.match(warnings.join('\n'), /missing package-local README.md/);
    assert.match(warnings.join('\n'), /missing plugin reference page/);
    assert.match(warnings.join('\n'), /repository.directory/);
  });
});

test('private packages skip publish rules, but templates need documentation', () => {
  fixture((root, add) => {
    const pkg = add('templates/web', { name: '@katakit/web', private: true });
    const { errors, warnings } = checkWorkspace(root, [pkg]);
    assert.deepEqual(errors, []);
    assert.match(warnings.join('\n'), /missing template reference page/);
    assert.doesNotMatch(warnings.join('\n'), /publishConfig/);
  });
});

test('a non-Apache package-local license remains an error', () => {
  fixture((root, add) => {
    const pkg = add('pkgs/example', { name: '@katakit/example', license: 'Apache-2.0' });
    writeFileSync(join(pkg.path, 'LICENSE'), 'wrong license text\n');
    const { errors } = checkWorkspace(root, [pkg]);
    assert.match(errors.join('\n'), /must contain the repository's Apache-2.0 license text/);
  });
});

test('duplicate names and dangling workspace dependencies are errors', () => {
  fixture((root, add) => {
    const first = add('demos/first', {
      name: '@katakit/duplicate',
      private: true,
      dependencies: { '@katakit/missing': 'workspace:*' },
    });
    const second = add('demos/second', { name: '@katakit/duplicate', private: true });
    const { errors } = checkWorkspace(root, [first, second]);
    assert.match(errors.join('\n'), /duplicate workspace package name/);
    assert.match(errors.join('\n'), /missing workspace package/);
  });
});

test('a complete published plugin passes without warnings', () => {
  fixture((root, add) => {
    const pkg = add('pkgs/example', {
      name: '@katakit/example',
      license: 'Apache-2.0',
      repository: { directory: 'pkgs/example' },
      publishConfig: { exports: { '.': './dist/index.js' } },
      main: './dist/index.js',
      types: './dist/index.d.ts',
      exports: {
        '.': {
          source: './src/index.ts',
          types: './dist/index.d.ts',
          default: './dist/index.js',
        },
      },
    });
    cpSync(join(root, 'LICENSE'), join(pkg.path, 'LICENSE'));
    writeFileSync(join(pkg.path, 'README.md'), '# Example\n');
    writeFileSync(join(pkg.path, 'AGENTS.md'), '# Example guidance\n');
    mkdirSync(join(pkg.path, 'src'));
    writeFileSync(join(pkg.path, 'src/index.ts'), 'export {};\n');
    mkdirSync(join(root, 'docs/pages/reference/plugins'), { recursive: true });
    writeFileSync(join(root, 'docs/pages/reference/plugins/example.md'), '# Example\n');
    assert.deepEqual(checkWorkspace(root, [pkg]), { errors: [], warnings: [] });
  });
});
