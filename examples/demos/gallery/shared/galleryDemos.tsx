import { lazy } from 'react';
import {
  transcriptionDemoDetails,
  bingoDemoDetails,
  notesDemoDetails,
  colorClashDemoDetails,
} from './galleryDemoDetails';
import { GalleryCaptureControls } from './GalleryCaptureControls';
import { GalleryDemo } from './GalleryDemo';
import { TranscriptionIntroduction } from './TranscriptionIntroduction';
import { GalleryDemoControls, useGalleryDemoHeader } from './GalleryDemoHeader';

// Named entries let another host import only its selected demos. Lazy construction is inert,
// so unused eligible entries can be removed without retaining their module loaders.
export const transcriptionGalleryDemo = {
  ...transcriptionDemoDetails,
  component: /* @__PURE__ */ lazy(async () => {
    const [{ TranscriptionDemo }, { createTranscriptionDemo }] = await Promise.all([
      import('../../transcription-react/src/TranscriptionDemo'),
      import('../../transcription-react/src/createTranscriptionDemo'),
    ]);
    return {
      default: () => {
        const hasHeader = useGalleryDemoHeader();
        return (
          <GalleryDemo
            create={createTranscriptionDemo}
            render={runtime => (
              <TranscriptionDemo
                runtime={runtime}
                controls={<GalleryCaptureControls />}
                introduction={<TranscriptionIntroduction />}
                showIntroduction={!hasHeader}
              />
            )}
          />
        );
      },
    };
  }),
};
export const bingoGalleryDemo = {
  ...bingoDemoDetails,
  component: /* @__PURE__ */ lazy(async () => {
    const [{ BrowserBingoDemo }, { createBrowserBingoDemo }] = await Promise.all([
      import('../../bingo-react/src/BrowserBingoDemo'),
      import('../../bingo-react/src/createBrowserBingoDemo'),
    ]);
    return {
      default: () => {
        const hasHeader = useGalleryDemoHeader();
        return (
          <GalleryDemo
            create={createBrowserBingoDemo}
            render={runtime => (
              <BrowserBingoDemo
                runtime={runtime}
                controls={<GalleryCaptureControls />}
                renderControls={controls => <GalleryDemoControls>{controls}</GalleryDemoControls>}
                showIntroduction={!hasHeader}
              />
            )}
          />
        );
      },
    };
  }),
};
export const notesGalleryDemo = {
  ...notesDemoDetails,
  component: /* @__PURE__ */ lazy(async () => ({
    default: (await import('./NotesGalleryDemo')).NotesGalleryDemo,
  })),
};
export const colorClashGalleryDemo = {
  ...colorClashDemoDetails,
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
