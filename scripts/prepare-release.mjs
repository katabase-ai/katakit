import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

// Keep package/build inputs at the original release SHA, but use the workflow's release runner.
export const prepareRelease = (baseSha, releaseSha, directory = root) => {
  for (const sha of [baseSha, releaseSha]) {
    if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('Use full base and release commit SHAs');
  }
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  const toolingSha = git('rev-parse', 'HEAD');
  git('merge-base', '--is-ancestor', baseSha, releaseSha);
  git('merge-base', '--is-ancestor', releaseSha, toolingSha);
  git('diff', '--exit-code', 'HEAD');
  const runner = execFileSync('git', ['show', `${toolingSha}:scripts/release.mjs`], {
    cwd: directory,
  });
  git('checkout', '--detach', releaseSha);
  writeFileSync(join(directory, 'scripts/release.mjs'), runner);
  return { baseSha, releaseSha, toolingSha };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.GITHUB_REF !== 'refs/heads/main')
    throw new Error('Release workflows must run from main');
  console.log(JSON.stringify(prepareRelease(...process.argv.slice(2)), null, 2));
}
