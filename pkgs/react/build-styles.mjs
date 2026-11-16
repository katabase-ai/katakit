import { readFile, writeFile } from 'node:fs/promises';
import { transform } from 'lightningcss';

const { code } = transform({
  filename: 'dev-tools.css',
  code: await readFile(new URL('./src/dev-tools/styles.css', import.meta.url)),
  minify: true,
  targets: { chrome: 100 << 16, firefox: 100 << 16, safari: 15 << 16 },
});
await writeFile(new URL('./dist/dev-tools.css', import.meta.url), code);
