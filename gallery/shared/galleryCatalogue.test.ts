import { expect, test, vi } from 'vitest';
import { build, normalizePath } from 'vite';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { galleryDemoDetails, bingoDemoDetails, galleryDataHandling } from './galleryDemoDetails';
import { galleryDemos, registerGalleryDemo } from './galleryDemos';

// These factories fail if metadata or registration eagerly evaluates a browser demo.
vi.mock('./BingoGalleryDemo', () => {
  throw new Error('eager Bingo import');
});
vi.mock('./TranscriptionGalleryDemo', () => {
  throw new Error('eager transcription import');
});
vi.mock('./NotesGalleryDemo', () => {
  throw new Error('eager Notes import');
});
vi.mock('./ColorClashGalleryDemo', () => {
  throw new Error('eager Color Clash import');
});
vi.mock('./ListExtractionGalleryDemo', () => {
  throw new Error('eager list extraction import');
});
vi.mock('./BrainstormGalleryDemo', () => {
  throw new Error('eager brainstorm import');
});

test('catalogue and registration are usable without evaluating any demo or invoking a loader', () => {
  const load = vi.fn(bingoDemoDetails.load);
  registerGalleryDemo({ ...bingoDemoDetails, load });
  expect(load).not.toHaveBeenCalled();
  expect(galleryDemos.map(demo => demo.id)).toEqual(galleryDemoDetails.map(demo => demo.id));
  expect(new Set(galleryDemoDetails.map(demo => demo.id)).size).toBe(galleryDemoDetails.length);
});

test('requirements preserve the existing privacy claims and game classification', () => {
  const cloudIds = galleryDemoDetails
    .filter(demo => galleryDataHandling(demo.requiredCapabilities).transcribedText === 'cloud')
    .map(demo => demo.id);
  expect(cloudIds).toEqual(['notes', 'list-extraction', 'brainstorm']);
  expect(
    galleryDemoDetails
      .filter(demo => (demo.tags as readonly string[]).includes('game'))
      .map(demo => demo.id)
  ).toEqual(['bingo', 'color-clash', 'brainstorm']);
});

test('a host selecting Bingo retains its lazy chunk but no unselected demo modules', async () => {
  const entry = '\0gallery-selection';
  const gallery = fileURLToPath(new URL('./galleryDemos.tsx', import.meta.url));
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'gallery-selection',
        resolveId: id => (id === entry ? entry : undefined),
        load: id =>
          id === entry ? `export { bingoGalleryDemo } from ${JSON.stringify(gallery)};` : undefined,
      },
    ],
    build: {
      write: false,
      minify: false,
      rolldownOptions: {
        input: entry,
        preserveEntrySignatures: 'strict',
        external: id => id !== entry && !id.startsWith('.') && !isAbsolute(id),
        output: { format: 'es' },
      },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(result =>
    'output' in result ? result.output : []
  );
  const chunks = outputs.filter(output => output.type === 'chunk');
  const modules = chunks.flatMap(chunk => Object.keys(chunk.modules).map(normalizePath));
  expect(modules.some(id => id.endsWith('/BingoGalleryDemo.tsx'))).toBe(true);
  expect(chunks.find(chunk => chunk.isEntry)?.dynamicImports.length).toBeGreaterThan(0);
  for (const name of [
    'NotesGalleryDemo',
    'ColorClashGalleryDemo',
    'TranscriptionGalleryDemo',
    'ListExtractionGalleryDemo',
    'BrainstormGalleryDemo',
  ]) {
    expect(modules.filter(id => id.endsWith(`/${name}.tsx`))).toEqual([]);
  }
}, 30_000);
