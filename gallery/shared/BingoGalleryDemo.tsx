import { BrowserBingoDemo } from '../../examples/demos/bingo-react/src/BrowserBingoDemo';
import { createBingoSession } from '../../examples/demos/bingo-react/src/bingo/createBingoSession';
import { createGalleryDemo } from './createGalleryDemo';

export const BingoGalleryDemo = createGalleryDemo({
  createRuntime: createBingoSession,
  View: BrowserBingoDemo,
});
