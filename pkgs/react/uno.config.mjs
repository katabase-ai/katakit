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
  // Preserve the previously shipped (unused) Layers icon rule.
  shortcuts: { 'kk-okdniw': 'inline-block size-4 shrink-0 i-lucide-layers-2' },
  safelist: ['kk-okdniw'],
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
    compileClass({ classPrefix: 'kk-', trigger: /(?<=\bclassName\s*=\s*)(["'])([\s\S]*?)\1/g }),
  ],
});
