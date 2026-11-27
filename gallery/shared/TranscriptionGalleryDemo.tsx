import { TranscriptionDemo } from '../../examples/demos/transcription/src/TranscriptionDemo';
import { createTranscriptionDemo } from '../../examples/demos/transcription/src/createTranscriptionDemo';
import { createGalleryDemo, type GalleryDemoViewProps } from './createGalleryDemo';
import { TranscriptionIntroduction } from './TranscriptionIntroduction';

const View = (props: GalleryDemoViewProps<ReturnType<typeof createTranscriptionDemo>>) => (
  <TranscriptionDemo {...props} introduction={<TranscriptionIntroduction />} />
);

export const TranscriptionGalleryDemo = createGalleryDemo({
  createRuntime: createTranscriptionDemo,
  View,
});
