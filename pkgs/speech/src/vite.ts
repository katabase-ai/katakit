import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { copySpeechAssets, listSpeechAssets, speechAssetsDirectory } from './assets';

const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};
const contentTypes: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain',
};

/** Serve packaged runtime files in dev, copy on build, and configure local COOP/COEP. */
export const speechAssetsPlugin = ({
  assetsPath = 'speech-assets',
}: { assetsPath?: string } = {}): Plugin => {
  const path = assetsPath.replace(/^\/+|\/+$/g, '');
  if (
    !path ||
    path.split('/').some(part => !part || part === '.' || part === '..' || !/^[\w.-]+$/.test(part))
  )
    throw new Error('assetsPath must be a relative directory without parent traversal.');
  let output: string | undefined;
  let mount = `/${path}/`;
  return {
    name: 'speech-assets',
    config: () => ({ server: { headers: isolation }, preview: { headers: isolation } }),
    configResolved: config => {
      mount = `${config.base === './' || config.base === '' ? '/' : config.base}${path}/`;
      if (config.command === 'build') output = resolve(config.root, config.build.outDir, path);
    },
    configureServer: async server => {
      let files: Set<string>;
      try {
        files = new Set(await listSpeechAssets());
      } catch {
        throw new Error(
          'Speech runtime assets are missing. In this workspace, run pnpm --filter @katakit/speech build. Published packages include these files.'
        );
      }
      server.middlewares.use(async (request, response, next) => {
        let filename: string;
        try {
          const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
          if (!pathname.startsWith(mount)) return next();
          filename = decodeURIComponent(pathname.slice(mount.length));
        } catch {
          response.writeHead(400).end();
          return;
        }
        if (!files.has(filename)) {
          response.writeHead(404).end();
          return;
        }
        try {
          response
            .writeHead(200, {
              ...isolation,
              'Cross-Origin-Resource-Policy': 'same-origin',
              'Content-Type': contentTypes[extname(filename)] ?? 'application/octet-stream',
            })
            .end(await readFile(join(speechAssetsDirectory, filename)));
        } catch {
          response.writeHead(404).end();
        }
      });
    },
    closeBundle: async () => {
      if (output) await copySpeechAssets(output);
    },
  };
};
