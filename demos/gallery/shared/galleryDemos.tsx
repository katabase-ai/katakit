import { lazy } from 'react';
import { galleryDemoDetails } from './galleryDemoDetails';
import { GalleryDemo } from './GalleryDemo';
import { TranscriptionIntroduction, TranscriptionSetupComplete } from './TranscriptionIntroduction';

// Named entries let another host import only its selected demos. Lazy construction is inert,
// so unused eligible entries can be removed without retaining their module loaders.
export const transcriptionGalleryDemo = {
  ...galleryDemoDetails[0],
  component: /* @__PURE__ */ lazy(async () => {
    const [{ TranscriptionDemo }, { createTranscriptionDemo }] = await Promise.all([
      import('../../transcription-react/src/TranscriptionDemo'),
      import('../../transcription-react/src/createTranscriptionDemo'),
    ]);
    return {
      default: () => (
        <GalleryDemo
          create={createTranscriptionDemo}
          render={runtime => (
            <TranscriptionDemo
              runtime={runtime}
              introduction={<TranscriptionIntroduction />}
              afterFirstSpeech={<TranscriptionSetupComplete />}
            />
          )}
        />
      ),
    };
  }),
};
export const bingoGalleryDemo = {
  ...galleryDemoDetails[1],
  component: /* @__PURE__ */ lazy(async () => {
    const [{ BrowserBingoDemo }, { createBrowserBingoDemo }] = await Promise.all([
      import('../../bingo-react/src/BrowserBingoDemo'),
      import('../../bingo-react/src/createBrowserBingoDemo'),
    ]);
    return {
      default: () => (
        <GalleryDemo
          create={createBrowserBingoDemo}
          render={runtime => <BrowserBingoDemo runtime={runtime} />}
        />
      ),
    };
  }),
};
export const notesGalleryDemo = {
  ...galleryDemoDetails[2],
  component: /* @__PURE__ */ lazy(async () => ({
    default: (await import('./NotesGalleryDemo')).NotesGalleryDemo,
  })),
};
export const colorClashGalleryDemo = {
  ...galleryDemoDetails[3],
  component: /* @__PURE__ */ lazy(async () => ({
    default: (await import('./ColorClashGalleryDemo')).ColorClashGalleryDemo,
  })),
};
export const galleryDemos = [
  transcriptionGalleryDemo,
  bingoGalleryDemo,
  notesGalleryDemo,
  colorClashGalleryDemo,
];
