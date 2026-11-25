import { defineConfig } from 'tsdown';
import { createGenerator, LAYER_IMPORTS } from 'unocss';
import UnoCSS from 'unocss/rolldown';
import config from './uno.config.mjs';
import { readFileSync } from 'node:fs';

const stylesheetId = 'virtual:katakit-stylesheet';
const marker = '__KATAKIT_UNO_STYLESHEET_URL__';
const timelineCss = readFileSync(new URL('./src/timeline.css', import.meta.url), 'utf8');

// UnoCSS emits its asset after transforming all JSX. Replace the virtual
// module's one-line string with a one-line URL so mapped TSX lines don't move.
const embedStylesheet = {
  name: 'katakit:embed-stylesheet',
  resolveId(id) {
    if (id === stylesheetId) return `\0${id}`;
  },
  async load(id) {
    if (id !== `\0${stylesheetId}`) return;
    // Rolldown omits Uno's imports layer. Mount only its provider stylesheet
    // at document scope so the shadow tree can use the registered font faces.
    const uno = await createGenerator(config);
    const imports = (await uno.generate('', { minify: true })).getLayer(LAYER_IMPORTS);
    const fontUrl = imports.match(/^@import url\('([^']+)'\);$/)?.[1];
    if (!fontUrl) this.error('Expected a web font provider stylesheet from UnoCSS');
    return `import 'uno.css'; export default '${marker}'; export const fontStylesheet = ${JSON.stringify(fontUrl)}`;
  },
  generateBundle: {
    order: 'post',
    handler(_, bundle) {
      const css = Object.values(bundle).find(
        file => file.type === 'asset' && file.names.includes('uno.css')
      );
      const entry = bundle['index.js'];
      if (!css || entry?.type !== 'chunk' || !entry.code.includes(marker))
        this.error('Missing UnoCSS stylesheet or its reference');
      const url = `data:text/css;base64,${Buffer.from(String(css.source) + '\n' + timelineCss).toString('base64')}`;
      entry.code = entry.code.replace(marker, url) + '//# sourceMappingURL=index.js.map\n';
      delete bundle[css.fileName];
      this.emitFile({ type: 'asset', fileName: 'timeline.css', source: timelineCss });
      this.emitFile({
        type: 'asset',
        fileName: 'timeline.css.d.ts',
        source: 'declare const stylesheet: string;\nexport default stylesheet;\n',
      });
    },
  },
};

// oxlint-disable-next-line import/no-default-export -- tsdown loads the default export.
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  fixedExtension: false,
  dts: { sourcemap: false },
  // Link the JS map in the adapter; the declarations have no map.
  sourcemap: 'hidden',
  clean: true,
  plugins: [UnoCSS(), embedStylesheet],
});
