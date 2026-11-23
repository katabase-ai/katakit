import { icons } from '@iconify-json/lucide';
import compileClass from '@unocss/transformer-compile-class';
import {
  defineConfig,
  presetIcons,
  presetWebFonts,
  presetWind4,
  transformerVariantGroup,
} from 'unocss';

// oxlint-disable-next-line import/no-default-export -- UnoCSS loads the default export.
export default defineConfig({
  extractorDefault: false,
  shortcuts: {
    'tool-button-chrome':
      'shrink-0 items-center justify-center gap-1.5 rounded-md font-medium text-xs cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-300 disabled:opacity-40 disabled:cursor-default',
    'tool-button-icon': 'inline-block size-4 shrink-0',
  },
  presets: [
    // Chromium doesn't register @property inside shadow trees. Emit the preset's
    // ordinary custom-property defaults in this isolated stylesheet as well.
    presetWind4({ preflights: { property: { parent: false } } }),
    presetWebFonts({
      provider: 'google',
      inlineImports: false,
      fonts: {
        sans: { name: 'Inter', weights: ['400..700'] },
        mono: { name: 'JetBrains Mono', weights: ['400..700'] },
      },
    }),
    presetIcons({ collections: { lucide: icons } }),
  ],
  transformers: [
    transformerVariantGroup(),
    // Compile JSX className literals and explicit :uno: strings in button variants.
    compileClass({
      classPrefix: 'kk-',
      trigger: /(["'])(?:(?<=\bclassName\s*=\s*["'])|:uno:\s+)([\s\S]*?)\1/g,
    }),
  ],
});
