import { lazy } from 'react';
import { galleryDemoDetails } from './galleryDemoDetails';
import { GalleryDemo } from './GalleryDemo';
import type { GalleryModelSelect } from './GallerySpeechControls';

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
      default: ({ renderModelSelect }: { renderModelSelect?: GalleryModelSelect }) => (
        <GalleryDemo
          create={createTranscriptionDemo}
          renderModelSelect={renderModelSelect}
          render={(runtime, controls) => (
            <TranscriptionDemo runtime={runtime} controls={controls} />
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
      default: ({ renderModelSelect }: { renderModelSelect?: GalleryModelSelect }) => (
        <GalleryDemo
          create={createBrowserBingoDemo}
          renderModelSelect={renderModelSelect}
          render={(runtime, controls) => <BrowserBingoDemo runtime={runtime} controls={controls} />}
        />
      ),
    };
  }),
};
export const galleryDemos = [transcriptionGalleryDemo, bingoGalleryDemo];
