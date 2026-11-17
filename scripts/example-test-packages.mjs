import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const packages = ['core', 'event-log', 'transcript-ingestion', 'transcription'];

export const runPnpm = (cwd, args) => {
  const cli = process.env.npm_execpath;
  const result = spawnSync(cli ? process.execPath : 'pnpm', cli ? [cli, ...args] : args, {
    cwd,
    stdio: 'inherit',
    shell: !cli && process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pnpm ${args.join(' ')} failed (${result.status})`);
};

// Build packages for standalone copy checks. The runner owns the packed artifacts
// until every temporary installation is finished.
export const withExamplePackages = async check => {
  const temporary = mkdtempSync(join(tmpdir(), 'katakit-test-packages-'));
  try {
    const overrides = {};
    for (const name of packages) {
      const manifest = JSON.parse(readFileSync(join(root, 'pkgs', name, 'package.json'), 'utf8'));
      runPnpm(root, ['--filter', manifest.name, 'build']);
      runPnpm(root, ['--filter', manifest.name, 'pack', '--pack-destination', temporary]);
      const archive = join(temporary, `katakit-${name}-${manifest.version}.tgz`);
      if (!existsSync(archive)) throw new Error(`Missing packed package: ${archive}`);
      overrides[manifest.name] = `file:${archive.replaceAll('\\', '/')}`;
    }
    await check(target => {
      const file = join(target, 'pnpm-workspace.yaml');
      const yaml = existsSync(file) ? readFileSync(file, 'utf8') : '';
      if (/^overrides:/m.test(yaml)) throw new Error('Example must not ship dependency overrides');
      writeFileSync(
        file,
        `${yaml}\noverrides:\n${Object.entries(overrides)
          .map(([name, archive]) => `  '${name}': ${JSON.stringify(archive)}\n`)
          .join('')}`
      );
    });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
};
