import { defineConfig } from 'tsdown';
import UnoCSS from 'unocss/rolldown';

const stylesheetId = 'virtual:katakit-stylesheet';
const marker = '__KATAKIT_UNO_STYLESHEET_URL__';

// UnoCSS emits its asset after transforming all JSX. Replace the virtual
// module's one-line string with a one-line URL so mapped TSX lines don't move.
const embedStylesheet = {
  name: 'katakit:embed-stylesheet',
  resolveId(id) {
    if (id === stylesheetId) return `\0${id}`;
  },
  load(id) {
    if (id === `\0${stylesheetId}`) return `import 'uno.css'; export default '${marker}'`;
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
      const url = `data:text/css;base64,${Buffer.from(css.source).toString('base64')}`;
      entry.code = entry.code.replace(marker, url) + '//# sourceMappingURL=index.js.map\n';
      delete bundle[css.fileName];
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
  loader: { '.woff2': 'dataurl' },
  deps: { onlyBundle: ['@fontsource-variable/jetbrains-mono'] },
  plugins: [UnoCSS(), embedStylesheet],
});
