import { readFile, rm } from 'node:fs/promises';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportDocs } from '../../pkgs/docs-export/exportDocs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const moduleId = 'virtual:katakit-docs';
const resolvedId = `\0${moduleId}`;

/** Watch source inputs, excluding generated output so rebuilding cannot trigger itself. */
export const isDocsInput = path => {
  const file = relative(root, path).replaceAll('\\', '/');
  return (
    /^docs\/(pages\/|public\/|scripts\/(generate-nav|check-links)\.mjs$)/.test(file) ||
    /^pkgs\/[^/]+\/(src\/.*\.tsx?$|package\.json$)/.test(file) ||
    /^pkgs\/docs-export\/.*\.(mjs|json)$/.test(file) ||
    ['pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file)
  );
};

/** Coalesce edits during extraction into one subsequent build, never overlapping exports. */
export const queueDocsExport = ({ build, onError, delay = 250 }) => {
  let timer;
  let running = false;
  let pending = false;
  let closed = false;
  const run = async () => {
    if (closed || running) return;
    pending = false;
    running = true;
    try {
      await build();
    } catch (error) {
      onError(error);
    } finally {
      running = false;
      if (pending && !closed) timer = setTimeout(run, delay);
    }
  };
  return {
    schedule: () => {
      if (closed) return;
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(run, delay);
    },
    close: () => {
      closed = true;
      clearTimeout(timer);
    },
  };
};

/** Both Vite builds and local previews consume the public export, without a private checkout. */
export const docsExportPlugin = () => {
  mkdirSync(join(root, '.tmp'), { recursive: true });
  // Builds and dev servers may run together; each owns its staging directory.
  const output = mkdtempSync(join(root, '.tmp/docs-viewer-'));
  let source;
  let current = Promise.resolve();
  let stopWatching = () => {};
  const build = async () => {
    const previous = current;
    let finish;
    current = new Promise(resolve => {
      finish = resolve;
    });
    await previous;
    try {
      const manifest = await exportDocs({ output });
      const pages = Object.fromEntries(
        await Promise.all(
          manifest.pages.map(async page => [
            page.slug,
            { file: page.file, markdown: await readFile(join(output, page.file), 'utf8') },
          ])
        )
      );
      // Asset URL imports let Vite serve files locally and copy/hash them for static previews.
      const imports = manifest.assets.map(
        (asset, index) =>
          `import asset${index} from ${JSON.stringify(`${join(output, asset)}?url&no-inline`)};`
      );
      const assets = manifest.assets.map(
        (asset, index) => `${JSON.stringify(asset)}: asset${index}`
      );
      source = `${imports.join('\n')}\nexport const bundle = { navigation: ${JSON.stringify(manifest.navigation)}, pages: ${JSON.stringify(pages)}, assets: {${assets.join(',')}} };`;
    } finally {
      // Release queued exports even after a conversion error.
      finish();
    }
  };
  return {
    name: 'katakit-docs-export',
    buildStart: build,
    closeBundle: async () => {
      stopWatching();
      await current;
      await rm(output, { recursive: true, force: true });
    },
    resolveId: id => (id === moduleId ? resolvedId : undefined),
    load: async id => {
      if (id !== resolvedId) return;
      await current;
      return source;
    },
    configureServer: server => {
      const queue = queueDocsExport({
        build: async () => {
          server.config.logger.info('Rebuilding documentation export…');
          await build();
          const module = server.moduleGraph.getModuleById(resolvedId);
          if (module) server.moduleGraph.invalidateModule(module);
          server.ws.send({ type: 'full-reload' });
        },
        onError: error => {
          server.config.logger.error(error.stack ?? String(error));
          server.ws.send({
            type: 'error',
            err: {
              message: error.message,
              stack: error.stack ?? '',
              plugin: 'katakit-docs-export',
            },
          });
        },
      });
      const onChange = (_event, path) => {
        // Vite reloads imported exporter/config modules itself; do not start a second export.
        if (isDocsInput(path) && !server.config.configFileDependencies.includes(path)) {
          queue.schedule();
        }
      };
      server.watcher.add([
        join(root, 'pkgs'),
        join(root, 'docs'),
        join(root, 'pnpm-lock.yaml'),
        join(root, 'pnpm-workspace.yaml'),
      ]);
      server.watcher.on('all', onChange);
      stopWatching = () => {
        queue.close();
        server.watcher.off('all', onChange);
      };
      server.httpServer?.once('close', stopWatching);
    },
  };
};
