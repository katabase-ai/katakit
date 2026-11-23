import { icons } from '@iconify-json/lucide';
import compileClass from '@unocss/transformer-compile-class';
import { defineConfig, presetIcons, presetWebFonts, presetWind4, transformerVariantGroup } from 'unocss';

export default defineConfig({
  presets: [
    presetWind4(),
    presetWebFonts({ provider: 'none', fonts: { sans: 'Geist', mono: 'Geist Mono' } }),
    presetIcons({ collections: { lucide: icons } }),
  ],
  transformers: [
    transformerVariantGroup(),
    compileClass({ classPrefix: 'kk-', trigger: /(?<=\bclassName\s*=\s*)(["'])([\s\S]*?)\1/g }),
  ],
});
