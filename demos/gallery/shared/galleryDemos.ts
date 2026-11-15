import { lazy } from 'react';
import { galleryDemoDetails } from './galleryDemoDetails';

// Loaders are separate from metadata so a directory-only host does not bundle the legacy
// recognizers. Replace the standalone components with session-aware views after PR #28.
const components = {
  transcription: lazy(async () => {
    const { TranscriptionDemo } = await import('../../transcription-react/src/App');
    return { default: TranscriptionDemo };
  }),
  bingo: lazy(async () => {
    const { BrowserBingoDemo } = await import('../../bingo-react/src/App');
    return { default: BrowserBingoDemo };
  }),
};

export const galleryDemos = galleryDemoDetails.map(demo => ({
  ...demo,
  component: components[demo.id],
}));
