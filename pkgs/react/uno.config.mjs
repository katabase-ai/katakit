import { icons } from '@iconify-json/lucide';
import compileClass from '@unocss/transformer-compile-class';
import {
  defineConfig,
  presetIcons,
  presetWebFonts,
  presetWind4,
  transformerVariantGroup,
} from 'unocss';

export const config = defineConfig({
  presets: [
    // Chromium doesn't register @property inside shadow trees. Emit the preset's
    // ordinary custom-property defaults in this isolated stylesheet as well.
    presetWind4({ preflights: { property: { parent: false } } }),
    presetWebFonts({ provider: 'none', fonts: { sans: 'Geist', mono: 'Geist Mono' } }),
    presetIcons({ collections: { lucide: icons } }),
  ],
  transformers: [
    transformerVariantGroup(),
    compileClass({ classPrefix: 'kk-', trigger: /(?<=\bclassName\s*=\s*)(["'])([\s\S]*?)\1/g }),
  ],
});
