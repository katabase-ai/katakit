// Run the real notes request against every provider default with keys from the shell or
// .env.local: `pnpm check:models`. Vite loads the TypeScript modules, so no extra tooling is needed.
import { fileURLToPath } from 'node:url';
import { createServer, loadEnv } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({
  root,
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false },
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
});
try {
  const { checkDefaultModels } = await server.ssrLoadModule('/inference/defaultModelCheck.ts');
  const results = await checkDefaultModels(loadEnv('development', root, ''));
  for (const { provider, model, result, detail, latencyMs, tokens } of results) {
    const measured = [latencyMs && `${latencyMs} ms`, tokens && `${tokens} tokens`].filter(Boolean);
    console.log(
      `${result.padEnd(7)} ${provider} ${model}${measured.length ? ` (${measured.join(', ')})` : ''}`
    );
    console.log(`        ${detail}`);
  }
  const checked = results.filter(({ result }) => result !== 'skipped');
  if (!checked.length) {
    console.error('No provider keys found. Export at least one provider API key.');
    process.exitCode = 1;
  } else if (checked.some(({ result }) => result === 'failed')) process.exitCode = 1;
} finally {
  await server.close();
}
