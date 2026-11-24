import { BrowserBingoDemo } from '../../examples/demos/bingo-react/src/BrowserBingoDemo';
import { createBrowserBingoDemo } from '../../examples/demos/bingo-react/src/createBrowserBingoDemo';
import { createGalleryDemo } from './createGalleryDemo';

export const BingoGalleryDemo = createGalleryDemo({
  createRuntime: createBrowserBingoDemo,
  View: BrowserBingoDemo,
});
