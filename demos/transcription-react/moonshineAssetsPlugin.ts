import { cp, mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { moonshineAssetBase } from './src/moonshineAssets';

const contentTypes: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
};

// Moonshine's worker and WASM files must remain siblings of its installed ESM files.
export const moonshineAssetsPlugin = (): Plugin => {
  const runtimeDir = dirname(fileURLToPath(import.meta.resolve('@moonshine-ai/moonshine-wasm')));
  let outputDir: string | undefined;
  return {
    name: 'moonshine-assets',
    configResolved: config => {
      if (config.command === 'build') {
        outputDir = resolve(config.root, config.build.outDir, moonshineAssetBase.slice(1));
      }
    },
    configureServer: server => {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        if (!pathname.startsWith(moonshineAssetBase)) return next();
        response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        const filename = pathname.slice(moonshineAssetBase.length);
        const contentType = contentTypes[extname(filename)];
        if (!contentType || filename.includes('/') || filename.includes('..')) {
          response.writeHead(404).end();
          return;
        }
        try {
          response
            .writeHead(200, { 'Content-Type': contentType })
            .end(await readFile(join(runtimeDir, filename)));
        } catch {
          response.writeHead(404).end();
        }
      });
    },
    closeBundle: async () => {
      if (!outputDir) return;
      await mkdir(outputDir, { recursive: true });
      for (const filename of await readdir(runtimeDir)) {
        if (contentTypes[extname(filename)]) {
          await cp(join(runtimeDir, filename), join(outputDir, filename));
        }
      }
    },
  };
};
